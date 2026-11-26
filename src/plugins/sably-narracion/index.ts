// Plugin de EmDash «sably-narracion» para sably.co. Con la narración automática encendida en el panel, narra cada
// artículo que se publica (gancho + trabajador en segundo plano + cron de respaldo); de fábrica no hace nada solo, con cola idempotente por huella del texto y voz, reintentos, topes
// de gasto y disyuntor del proveedor. Panel «Sably · narraciones». Diseño en
// docs/equipo/2026-11-25/narraciones/DISENO.md (carpeta sably.co). Base: el plugin homónimo de terapiadpareja.com.
import { definePlugin, pluginResponse, PluginRouteError, type PluginContext, type PluginRoute, type RouteContext } from "emdash";
import { Cola, ALMACENAMIENTO, idEntrada, type Almacen, type Toma, type Permiso } from "./src/cola";
import { bloquesDe, COLECCIONES, pluginId, validarVoz, type Config, type Voz } from "./src/config";
import { archivoValido, carpetaAudios } from "./src/deposito";
import { aMp3, medir, normalizar, recortar } from "./src/audio";
import { disponible, ErrorProveedor, PROVEEDORES, proveedor as obtenerProveedor } from "./src/proveedores";
import { estimar, procesar } from "./src/trabajador";
import { guion, huella, sha256 } from "./src/texto";

export { pluginId };
export const pluginVersion = "1.0.0";

type Entrada = { id?: unknown; slug?: unknown; status?: unknown; data?: unknown };

/** Que el reproductor aparezca o desaparezca sin esperar a que caduque la copia de la página (solo Node). */
async function invalidarPaginas() {
  if (process.env.SABLY_RUNTIME !== "node") return;
  const { invalidateNodePages } = await import("../../lib/node/cache-provider");
  invalidateNodePages();
}

export function colaDe(ctx: Pick<PluginContext, "storage" | "kv">) {
  const s = ctx.storage as unknown as Omit<Almacen, "kv">;
  return new Cola({ tomas: s.tomas, publicadas: s.publicadas, voces: s.voces, permisos: s.permisos, kv: ctx.kv as unknown as Almacen["kv"] },
    Date.now, invalidarPaginas);
}

function datosDe(entrada: Entrada) {
  const datos = (entrada.data && typeof entrada.data === "object" ? entrada.data : entrada) as Record<string, unknown>;
  const slug = typeof entrada.slug === "string" ? entrada.slug : typeof datos.slug === "string" ? datos.slug : "";
  return { datos, slug };
}

/** Encola una entrada si su colección está activa y su texto con su voz aún no tiene audio. */
export async function encolarEntrada(cola: Cola, coleccion: string, entrada: Entrada, origen: Toma["origen"], extra: { lote?: string; forzar?: boolean; config?: Config } = {}) {
  const config = extra.config ?? (await cola.config());
  if (!config.colecciones[coleccion]) return undefined;
  const { datos, slug } = datosDe(entrada);
  const bloques = bloquesDe(coleccion, datos, config);
  if (!slug || !bloques.length) return undefined;
  const voz = await cola.vozDeEntrada(coleccion, slug, config);
  const perfil = { proveedor: voz.proveedor, voz: voz.voz, ...(voz.modelo ? { modelo: voz.modelo } : {}), normalizador: "1", vozId: voz.id };
  return cola.encolar({
    coleccion, slug, titulo: typeof datos.title === "string" ? datos.title : slug, bloques, huella: await huella(bloques), voz, origen,
    costoEstimadoUsd: estimar(bloques, perfil, config).usd, ...extra,
  });
}

let enMarcha: Promise<unknown> | undefined;
/** Despierta al trabajador sin bloquear la petición (en Node el proceso sigue vivo; el cron es el respaldo). */
function despertar(ctx: PluginContext) {
  if (enMarcha) return;
  enMarcha = procesar(colaDe(ctx), { limite: 5, registro: (m, d) => ctx.log.info(m, d) })
    .catch((e: Error) => ctx.log.warn("Trabajador de narraciones detenido", { error: e.message }))
    .finally(() => { enMarcha = undefined; });
}

const CRON = { nombre: "narracion-cola", cada: "*/10 * * * *" };
let cronAsegurado: Promise<unknown> | undefined;
/**
 * Registra la tarea del cron (es un upsert idempotente) la primera vez que el plugin recibe un gancho o una ruta en este
 * proceso. EmDash solo ejecuta `plugin:activate` cuando un plugin se activa desde el panel, nunca con los que vienen en
 * `astro.config.mjs`, así que el cron de respaldo no existía en producción (cola parada el 26-nov de 03:37 a 03:57).
 */
export function asegurarCron(ctx: Pick<PluginContext, "cron" | "log">) {
  if (!ctx.cron) return Promise.resolve();
  cronAsegurado ??= ctx.cron.schedule(CRON.nombre, { schedule: CRON.cada }).catch((e: Error) => {
    cronAsegurado = undefined;
    ctx.log.warn("No se pudo programar el cron de narraciones", { error: e.message });
  });
  return cronAsegurado;
}
/** Solo para pruebas: vuelve a intentar registrar el cron. */
export const olvidarCron = () => { cronAsegurado = undefined; };

/**
 * Gancho de publicar (también cuando lo publica el programador de EmDash a su hora): solo encola con la narración
 * automática encendida en el panel. Programar no narra: el audio nunca existe antes de la fecha de publicación.
 */
async function alPublicar(ctx: PluginContext, coleccion: string, contenido: Entrada) {
  await asegurarCron(ctx);
  try {
    const cola = colaDe(ctx);
    const config = await cola.config();
    if (!config.narrarAlPublicar) return;
    const r = await encolarEntrada(cola, coleccion, contenido, "publicar", { config });
    if (r?.resultado === "nuevo" && !r.reutilizada) despertar(ctx);
  } catch (e) {
    ctx.log.warn("No se pudo encolar la narración", { error: (e as Error).message });
  }
}

async function listarPublicadas(ctx: PluginContext, coleccion: string) {
  const items: Entrada[] = [];
  if (!ctx.content) return items;
  let cursor: string | undefined;
  do {
    const pagina = await ctx.content.list(coleccion, { limit: 100, cursor, where: { status: "published" } } as never);
    items.push(...(pagina.items as Entrada[]));
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return items;
}

/**
 * Conciliación (cron): vuelve a encolar las entradas publicadas que ya tenían narración y cuyo texto cambió, y las
 * publicadas después de activar el plugin. Las anteriores sin narración solo entran por el lote del panel.
 */
async function conciliar(ctx: PluginContext) {
  const cola = colaDe(ctx);
  const config = await cola.config();
  if (!config.narrarAlPublicar) return 0;
  let activado = await ctx.kv.get<number>("activado");
  if (!activado) await ctx.kv.set("activado", (activado = Date.now()));
  const publicadas = new Set((await cola.publicadasTodas()).map((p) => p.id));
  let nuevas = 0;
  for (const coleccion of Object.keys(COLECCIONES)) {
    if (!config.colecciones[coleccion]) continue;
    for (const item of await listarPublicadas(ctx, coleccion)) {
      const { datos, slug } = datosDe(item);
      const publicadaEn = Date.parse(String(datos.publishedAt ?? datos.published_at ?? (item as Record<string, unknown>).publishedAt ?? ""));
      if (!publicadas.has(idEntrada(coleccion, slug)) && !(publicadaEn >= activado)) continue;
      const r = await encolarEntrada(cola, coleccion, item, "conciliar", { config });
      if (r?.resultado === "nuevo") nuevas++;
    }
  }
  return nuevas;
}

async function estimarLote(ctx: PluginContext) {
  const cola = colaDe(ctx);
  const config = await cola.config();
  const publicadas = new Map((await cola.publicadasTodas()).map((p) => [p.id, p.data]));
  const faltan: { coleccion: string; slug: string; titulo: string; minutos: number; usd: number; item: Entrada }[] = [];
  for (const coleccion of Object.keys(COLECCIONES)) {
    if (!config.colecciones[coleccion]) continue;
    for (const item of await listarPublicadas(ctx, coleccion)) {
      const { datos, slug } = datosDe(item);
      const bloques = bloquesDe(coleccion, datos, config);
      if (!slug || !bloques.length) continue;
      const vigente = publicadas.get(idEntrada(coleccion, slug));
      if (vigente && vigente.huella === (await huella(bloques))) continue;
      const voz = await cola.vozDeEntrada(coleccion, slug, config);
      const e = estimar(bloques, { proveedor: voz.proveedor, voz: voz.voz, modelo: voz.modelo, normalizador: "1", vozId: voz.id }, config);
      faltan.push({ coleccion, slug, titulo: String(datos.title ?? slug), minutos: Math.round((e.segundos / 60) * 10) / 10, usd: e.usd, item });
    }
  }
  const usd = faltan.reduce((s, f) => s + f.usd, 0);
  const minutos = faltan.reduce((s, f) => s + f.minutos, 0);
  return { config, faltan, usd: Math.round(usd * 1e4) / 1e4, minutos: Math.round(minutos * 10) / 10 };
}

const ID_TOMA = /^[a-z0-9_-]{1,64}:[a-z0-9-]{1,160}:[a-f0-9]{12}:[a-f0-9]{8}:\d{1,4}$/;
const idDe = (v: unknown) => {
  if (typeof v !== "string" || !ID_TOMA.test(v)) throw PluginRouteError.badRequest("Toma no válida.");
  return v;
};
const quien = (ctx: RouteContext) => String((ctx.user as { email?: string; id?: string } | undefined)?.email ?? ctx.user?.id ?? "editor");
const entrada = (ctx: RouteContext) => (ctx.input ?? {}) as Record<string, unknown>;

function ruta(permission: "content:publish_any" | "settings:manage", method: "GET" | "POST", handler: (ctx: RouteContext) => Promise<unknown>, maxBytes = 16_384): PluginRoute {
  return {
    methods: [method], permission,
    request: { body: method === "GET" ? "none" : "json", ...(method === "POST" ? { maxBytes } : {}) },
    handler: async (ctx: RouteContext) => {
      await asegurarCron(ctx);
      try {
        return await handler(ctx);
      } catch (e) {
        if (e instanceof PluginRouteError) throw e;
        throw PluginRouteError.badRequest((e as Error).message ?? "No se pudo completar.");
      }
    },
  } as PluginRoute;
}

const FRASE_PRUEBA = "Hola. Esta es la voz con la que Sably narra sus artículos: aprende un oficio a tu ritmo, con lecciones en vídeo y en español.";

export function createPlugin() {
  return definePlugin({
    id: pluginId,
    version: pluginVersion,
    capabilities: ["content:read"],
    storage: ALMACENAMIENTO as never,
    admin: { pages: [{ path: "/narraciones", label: "Narraciones", icon: "headphones" }] },
    hooks: {
      // Solo programa el cron; con la narración automática apagada el cron no encola ni genera nada. Ojo: EmDash no lo
      // ejecuta con plugins declarados en la configuración; por eso también lo asegura cualquier gancho o ruta.
      "plugin:activate": async (_event, ctx) => {
        await asegurarCron(ctx);
      },
      "content:afterPublish": async (event, ctx) => alPublicar(ctx, event.collection, event.content as Entrada),
      "content:afterUnpublish": async (event, ctx) => {
        await asegurarCron(ctx);
        const { slug } = datosDe(event.content as Entrada);
        if (slug) await colaDe(ctx).retirar(event.collection, slug).catch(() => false);
      },
      "content:afterDelete": async (event, ctx) => {
        const e = event as unknown as { collection: string; content?: Entrada; slug?: string };
        const slug = e.slug ?? (e.content ? datosDe(e.content).slug : "");
        if (slug) await colaDe(ctx).retirar(e.collection, slug).catch(() => false);
      },
      cron: async (event, ctx) => {
        if (event.name !== CRON.nombre) return;
        const nuevas = await conciliar(ctx).catch((e: Error) => (ctx.log.warn("Conciliación fallida", { error: e.message }), 0));
        if (nuevas) ctx.log.info("Narraciones encoladas al conciliar", { nuevas });
        const r = await procesar(colaDe(ctx), { limite: 5, registro: (m, d) => ctx.log.info(m, d) });
        if (r.publicadas.length || r.revision.length || r.fallidas.length)
          ctx.log.info("Narraciones procesadas", { publicadas: r.publicadas.length, revision: r.revision.length, fallidas: r.fallidas.length, usd: r.costoUsd });
      },
    },
    routes: {
      estado: ruta("content:publish_any", "GET", async (ctx) => {
        const cola = colaDe(ctx);
        const config = await cola.config();
        const voces = await cola.voces();
        const proveedores = await Promise.all(Object.values(PROVEEDORES).map(async (p) => ({
          id: p.id, nombre: p.nombre, disponible: disponible(p), puedeClonar: p.puedeClonar, pausa: await cola.disyuntor(p.id),
        })));
        const tomas = (await cola.lista(100)).map(({ id, data }) => ({ id, ...data, bloques: undefined, palabras: data.bloques.join(" ").split(/\s+/).length }));
        const permisos = (await ctx.storage.permisos!.query({ limit: 100 })).items.map((i) => ({ id: i.id, ...(i.data as Permiso), muestraSha256: undefined }));
        return {
          config, voces, proveedores, tomas, permisos, colecciones: Object.fromEntries(Object.entries(COLECCIONES).map(([k, v]) => [k, v.etiqueta])),
          resumen: await cola.resumen(), gasto: await cola.gasto(), publicadas: (await cola.publicadasTodas()).length,
          deposito: { carpeta: carpetaAudios(), r2: Boolean(process.env.NARRACION_R2_TOKEN) },
        };
      }),
      guion: ruta("content:publish_any", "GET", async (ctx) => {
        const id = idDe(new URL(ctx.request.url).searchParams.get("id"));
        const cola = colaDe(ctx);
        const toma = await cola.a.tomas.get(id);
        if (!toma) throw PluginRouteError.notFound("Toma desconocida.");
        const config = await cola.config();
        return { texto: toma.bloques, guion: guion(toma.bloques, { pronunciaciones: config.pronunciaciones }).map((f) => f.texto), informe: toma.informe };
      }),
      escuchar: {
        methods: ["GET"], permission: "content:publish_any", request: { body: "none" }, response: "raw",
        handler: async (ctx: RouteContext) => {
          const toma = await colaDe(ctx).a.tomas.get(idDe(new URL(ctx.request.url).searchParams.get("id")));
          if (!toma?.archivo || !archivoValido(toma.archivo)) throw PluginRouteError.notFound("Sin audio para esta toma.");
          if (toma.deposito === "r2" && toma.url) return pluginResponse({ status: 302, headers: { Location: toma.url } });
          const { readFile } = await import("node:fs/promises");
          const { join, resolve } = await import("node:path");
          const datos = await readFile(join(resolve(carpetaAudios()), toma.archivo));
          return pluginResponse({ headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" }, body: { kind: "bytes", value: new Uint8Array(datos) } });
        },
      } as PluginRoute,
      ajustes: ruta("settings:manage", "POST", async (ctx) => {
        const cola = colaDe(ctx);
        const cambios = entrada(ctx) as Partial<Config>;
        if (cambios.voz && !(await cola.voz(String(cambios.voz)))) throw PluginRouteError.badRequest("Esa voz no está en el catálogo.");
        return cola.guardarConfig(cambios);
      }),
      "voz-nueva": ruta("settings:manage", "POST", async (ctx) => {
        const i = entrada(ctx);
        const voz: Partial<Voz> = { proveedor: String(i.proveedor ?? ""), voz: String(i.voz ?? "").trim(), etiqueta: String(i.etiqueta ?? "").trim().slice(0, 160),
          ...(typeof i.modelo === "string" && i.modelo.trim() ? { modelo: i.modelo.trim() } : {}) };
        const error = validarVoz(voz);
        if (error) throw PluginRouteError.badRequest(error);
        const id = voz.voz!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
        const cola = colaDe(ctx);
        if ((await cola.voces()).some((v) => v.id === id)) throw PluginRouteError.badRequest("Esa voz ya está en el catálogo.");
        const nueva: Voz = { ...(voz as Voz), id, origen: "biblioteca", activa: true, creada: Date.now() };
        await cola.a.voces.put(id, nueva);
        return nueva;
      }),
      "voz-activa": ruta("settings:manage", "POST", async (ctx) => {
        const i = entrada(ctx);
        const cola = colaDe(ctx);
        const voz = (await cola.voces()).find((v) => v.id === i.id);
        if (!voz) throw PluginRouteError.notFound("Voz desconocida.");
        if (!i.activa && (await cola.config()).voz === voz.id) throw PluginRouteError.badRequest("Es la voz por defecto: elige otra antes.");
        await cola.a.voces.put(voz.id, { ...voz, activa: i.activa === true });
        return { ok: true };
      }),
      "voz-probar": ruta("settings:manage", "POST", async (ctx) => {
        const cola = colaDe(ctx);
        const config = await cola.config();
        const voz = (await cola.voces()).find((v) => v.id === entrada(ctx).id);
        if (!voz) throw PluginRouteError.notFound("Voz desconocida.");
        const p = obtenerProveedor(voz.proveedor);
        if (config.topeMensualUsd <= 0) throw PluginRouteError.badRequest("Pon un tope de gasto mensual en Ajustes para probar voces.");
        if ((await cola.gasto()).usd >= config.topeMensualUsd) throw PluginRouteError.badRequest("Tope mensual alcanzado.");
        const texto = guion([FRASE_PRUEBA], { pronunciaciones: config.pronunciaciones }).map((f) => f.texto).join(" ");
        try {
          const r = await p.sintetizar(texto, voz, { estilo: config.estilo });
          await cola.sumarGasto(r.costoUsd);
          const mp3 = await aMp3(await normalizar(recortar(r.pcm)), { titulo: "Prueba de voz", artista: "Sably", comentario: "Prueba de voz." });
          return { mp3: Buffer.from(mp3).toString("base64"), usd: r.costoUsd, segundos: (await medir(r.pcm)).segundos };
        } catch (e) {
          if (e instanceof ErrorProveedor) throw PluginRouteError.badRequest(`El proveedor respondió: ${e.message}`);
          throw e;
        }
      }),
      clonar: ruta("settings:manage", "POST", async (ctx) => {
        const i = entrada(ctx);
        const p = PROVEEDORES[String(i.proveedor)];
        if (!p?.clonar) throw PluginRouteError.badRequest("Ese proveedor no permite clonar voces.");
        const persona = String(i.persona ?? "").trim();
        const medio = String(i.medio ?? "").trim();
        const fechaPermiso = String(i.fechaPermiso ?? "");
        if (i.consentimiento !== true || persona.length < 3 || medio.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPermiso))
          throw PluginRouteError.badRequest("Para clonar hace falta el permiso expreso de la persona: nombre, cómo lo dio, fecha y la casilla marcada.");
        const muestra = Buffer.from(String(i.muestra ?? ""), "base64");
        if (muestra.length < 50_000) throw PluginRouteError.badRequest("La muestra de voz es demasiado corta (mínimo 10 s de audio).");
        const muestraSha256 = await sha256(new Uint8Array(muestra));
        const cola = colaDe(ctx);
        const idPermiso = `permiso-${Date.now().toString(36)}`;
        const permiso: Permiso = {
          persona: persona.slice(0, 120), relacion: String(i.relacion ?? "").slice(0, 120), medio: medio.slice(0, 200), fechaPermiso,
          declaracion: "Tengo el permiso expreso de esta persona para clonar su voz y usarla en sably.co.", muestraSha256,
          registradoPor: quien(ctx), registrado: Date.now(),
        };
        await cola.a.permisos.put(idPermiso, permiso);
        const idVoz = `sably${Date.now().toString(36)}`;
        const r = await p.clonar({ datos: new Uint8Array(muestra), nombreArchivo: String(i.nombreArchivo ?? "muestra.mp3").slice(0, 80) }, idVoz);
        const voz: Voz = { id: idVoz, proveedor: p.id, voz: r.voz, etiqueta: `Voz clonada de ${permiso.persona}`, origen: "clonada", permiso: idPermiso, activa: true, creada: Date.now() };
        await cola.a.voces.put(idVoz, voz);
        return voz;
      }, 12 * 1024 * 1024),
      "retirar-permiso": ruta("settings:manage", "POST", async (ctx) => {
        const id = String(entrada(ctx).id ?? "");
        const cola = colaDe(ctx);
        const permiso = await cola.a.permisos.get(id);
        if (!permiso) throw PluginRouteError.notFound("Permiso desconocido.");
        await cola.a.permisos.put(id, { ...permiso, retirado: Date.now() });
        for (const v of await cola.voces()) if (v.permiso === id) await cola.a.voces.put(v.id, { ...v, activa: false });
        return { ok: true };
      }),
      regenerar: ruta("content:publish_any", "POST", async (ctx) => {
        const r = await colaDe(ctx).otraToma(idDe(entrada(ctx).id));
        despertar(ctx);
        return r;
      }),
      "cambiar-voz": ruta("content:publish_any", "POST", async (ctx) => {
        const i = entrada(ctx);
        const coleccion = String(i.coleccion ?? "");
        const slug = String(i.slug ?? "");
        const cola = colaDe(ctx);
        const voz = await cola.voz(String(i.voz ?? ""));
        if (!COLECCIONES[coleccion] || !voz) throw PluginRouteError.badRequest("Colección o voz no válida.");
        const item = (await listarPublicadas(ctx, coleccion)).find((e) => datosDe(e).slug === slug);
        if (!item) throw PluginRouteError.notFound("La entrada no está publicada.");
        await ctx.kv.set(`voz:${idEntrada(coleccion, slug)}`, voz.id);
        const r = await encolarEntrada(cola, coleccion, item, "panel");
        if (r?.resultado === "nuevo" && !r.reutilizada) despertar(ctx);
        return r ?? { resultado: "sin texto" };
      }),
      publicar: ruta("content:publish_any", "POST", async (ctx) => colaDe(ctx).publicar(idDe(entrada(ctx).id), quien(ctx))),
      rechazar: ruta("content:publish_any", "POST", async (ctx) => {
        const nota = String(entrada(ctx).nota ?? "").trim();
        if (!nota) throw PluginRouteError.badRequest("Indica qué hay que corregir.");
        return colaDe(ctx).rechazar(idDe(entrada(ctx).id), quien(ctx), nota);
      }),
      retirar: ruta("content:publish_any", "POST", async (ctx) => {
        const i = entrada(ctx);
        return { retirada: await colaDe(ctx).retirar(String(i.coleccion ?? ""), String(i.slug ?? "")) };
      }),
      reanudar: ruta("settings:manage", "POST", async (ctx) => {
        await colaDe(ctx).cerrarDisyuntor(String(entrada(ctx).proveedor ?? ""));
        despertar(ctx);
        return { ok: true };
      }),
      procesar: ruta("content:publish_any", "POST", async (ctx) => {
        if (enMarcha) await enMarcha;
        return procesar(colaDe(ctx), { limite: 3, registro: (m, d) => ctx.log.info(m, d) });
      }),
      lote: ruta("settings:manage", "GET", async (ctx) => {
        const { faltan, usd, minutos, config } = await estimarLote(ctx);
        return { entradas: faltan.map(({ item: _i, ...f }) => f), usd, minutos, topeLoteUsd: config.topeLoteUsd, gasto: await colaDe(ctx).gasto(), topeMensualUsd: config.topeMensualUsd };
      }),
      "lote-lanzar": ruta("settings:manage", "POST", async (ctx) => {
        if (entrada(ctx).confirmar !== true) throw PluginRouteError.badRequest("Confirma el lote.");
        const { faltan, config } = await estimarLote(ctx);
        const cola = colaDe(ctx);
        const lote = `lote-${Date.now().toString(36)}`;
        let acumulado = 0;
        const encoladas: string[] = [];
        const fuera: string[] = [];
        for (const f of faltan) {
          if (acumulado + f.usd > config.topeLoteUsd) { fuera.push(f.slug); continue; }
          const r = await encolarEntrada(cola, f.coleccion, f.item, "lote", { lote, config });
          if (r?.resultado === "nuevo") { encoladas.push(f.slug); if (!r.reutilizada) acumulado += f.usd; }
        }
        despertar(ctx);
        return { lote, encoladas, fuera, estimadoUsd: Math.round(acumulado * 1e4) / 1e4 };
      }),
    },
  });
}

export default createPlugin;
