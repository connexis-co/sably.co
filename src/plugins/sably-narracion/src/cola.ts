// Cola y registro de narraciones sobre el almacenamiento declarado del plugin (igual en SQLite y en D1).
//
// Estados: pendiente → generando → (revision | publicada). Desde revisión, publicada o rechazada. Una publicada pasa a
// «reemplazada» cuando otra ocupa su lugar y a «retirada» al despublicar la entrada. Un texto o una voz nuevos dejan
// «obsoletas» las tomas sin publicar del anterior. Una toma es única por (colección, slug, huella, perfil, número).
import { normalizarConfig, type Config, type Voz, VOCES_INICIALES } from "./config";
import { sha256, versionNormalizador } from "./texto";

export type Estado = "pendiente" | "generando" | "revision" | "publicada" | "reemplazada" | "rechazada" | "obsoleta" | "error" | "retirada";
export type Origen = "publicar" | "conciliar" | "lote" | "panel";

export interface Perfil {
  proveedor: string;
  voz: string;
  modelo?: string;
  normalizador: string;
  /** Id del catálogo (para mostrarlo en el panel). */
  vozId: string;
}

export interface Toma {
  coleccion: string;
  slug: string;
  titulo: string;
  huella: string;
  perfil: Perfil;
  perfilId: string;
  numero: number;
  estado: Estado;
  bloques: string[];
  origen: Origen;
  lote?: string;
  intentos: number;
  reintentarDesde: number;
  costoEstimadoUsd: number;
  archivo?: string;
  url?: string;
  deposito?: "r2" | "disco";
  segundos?: number;
  bytes?: number;
  sha256?: string;
  costoUsd?: number;
  informe?: Record<string, unknown>;
  error?: string;
  revisor?: string;
  creado: number;
  actualizado: number;
}

export interface Publicada {
  toma: string;
  coleccion: string;
  slug: string;
  huella: string;
  perfilId: string;
  vozId: string;
  proveedor?: string;
  voz?: string;
  url: string;
  archivo: string;
  deposito: "r2" | "disco";
  segundos: number;
  bytes: number;
  publicada: number;
}

export interface Permiso {
  persona: string;
  relacion: string;
  medio: string;
  fechaPermiso: string;
  declaracion: string;
  muestraSha256: string;
  registradoPor: string;
  registrado: number;
  retirado?: number;
}

/** Lo que el plugin usa de `StorageCollection` (así las pruebas usan una versión en memoria). */
export interface Coleccion<T> {
  get(id: string): Promise<T | null>;
  put(id: string, data: T): Promise<void>;
  delete(id: string): Promise<boolean>;
  getVersioned(id: string): Promise<{ value: T; revision: string } | null>;
  compareAndSet(id: string, expected: string | null, data: T): Promise<{ applied: boolean }>;
  query(o?: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; limit?: number; cursor?: string }):
    Promise<{ items: { id: string; data: T }[]; cursor?: string; hasMore: boolean }>;
  count(where?: Record<string, unknown>): Promise<number>;
}

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  getVersioned<T>(key: string): Promise<{ value: T; revision: string } | null>;
  compareAndSet(key: string, expected: string | null, value: unknown): Promise<{ applied: boolean }>;
  delete(key: string): Promise<boolean>;
}

export interface Almacen {
  tomas: Coleccion<Toma>;
  publicadas: Coleccion<Publicada>;
  voces: Coleccion<Voz>;
  permisos: Coleccion<Permiso>;
  kv: Kv;
}

/** Colecciones declaradas del plugin, con los índices que usan las consultas. */
export const ALMACENAMIENTO = {
  tomas: { indexes: ["estado", "coleccion", "slug", "huella", "perfilId", "lote", "actualizado", "creado", ["coleccion", "slug"], ["estado", "creado"], ["huella", "perfilId"]] },
  publicadas: { indexes: ["coleccion"] },
  voces: { indexes: ["proveedor"] },
  permisos: { indexes: ["registrado"] },
} as const;

export const INTENTOS = 3;
/** Espera antes del 2.º y 3.er intento de una toma. */
export const ESPERAS_MS = [5 * 60_000, 30 * 60_000, 2 * 3600_000];
/** Una toma «generando» más de este tiempo se da por interrumpida y vuelve a la cola. */
export const GENERACION_MAXIMA_MS = 20 * 60_000;

export const idToma = (t: Pick<Toma, "coleccion" | "slug" | "huella" | "perfilId" | "numero">) =>
  `${t.coleccion}:${t.slug}:${t.huella.slice(0, 12)}:${t.perfilId.slice(0, 8)}:${t.numero}`;
export const idEntrada = (coleccion: string, slug: string) => `${coleccion}:${slug}`;
export const mesDe = (ms: number) => new Date(ms).toISOString().slice(0, 7);

export async function idPerfil(p: Pick<Perfil, "proveedor" | "voz" | "modelo" | "normalizador">) {
  return (await sha256(JSON.stringify([p.proveedor, p.voz, p.modelo ?? "", p.normalizador]))).slice(0, 16);
}

export function perfilDeVoz(v: Voz): Perfil {
  return { proveedor: v.proveedor, voz: v.voz, ...(v.modelo ? { modelo: v.modelo } : {}), normalizador: versionNormalizador, vozId: v.id };
}

const VIVOS: Estado[] = ["pendiente", "generando", "revision", "publicada"];
const SIN_PUBLICAR: Estado[] = ["pendiente", "generando", "revision", "error"];

export type ResultadoEncolar =
  | { resultado: "nuevo"; id: string; toma: Toma; reutilizada: boolean }
  | { resultado: "existente"; id: string; toma: Toma }
  | { resultado: "vigente" };

async function todas<T>(c: Coleccion<T>, where: Record<string, unknown>, orderBy?: Record<string, "asc" | "desc">) {
  const salida: { id: string; data: T }[] = [];
  let cursor: string | undefined;
  do {
    const p = await c.query({ where, orderBy, limit: 100, cursor });
    salida.push(...p.items);
    cursor = p.hasMore ? p.cursor : undefined;
  } while (cursor && salida.length < 5000);
  return salida;
}

export class Cola {
  /** `avisar` se llama cuando cambia lo que suena en el sitio (para invalidar la caché de páginas). */
  constructor(readonly a: Almacen, private ahora: () => number = Date.now, private avisar: () => unknown = () => undefined) {}

  async config(): Promise<Config> {
    return normalizarConfig(await this.a.kv.get("config"));
  }

  async guardarConfig(cambios: Partial<Config>): Promise<Config> {
    const config = normalizarConfig({ ...(await this.config()), ...cambios });
    await this.a.kv.set("config", config);
    return config;
  }

  /** Catálogo de voces; la primera vez siembra las dos voces de terapiadpareja. */
  async voces(): Promise<Voz[]> {
    let lista = (await this.a.voces.query({ limit: 100 })).items.map((i) => i.data);
    if (!lista.length) {
      for (const v of VOCES_INICIALES) await this.a.voces.put(v.id, v);
      lista = [...VOCES_INICIALES];
    }
    return lista.sort((x, y) => x.creada - y.creada || x.id.localeCompare(y.id));
  }

  async voz(id: string): Promise<Voz | undefined> {
    return (await this.voces()).find((v) => v.id === id && v.activa);
  }

  /** Voz de una entrada: la elegida para ella en el panel o la voz por defecto. */
  async vozDeEntrada(coleccion: string, slug: string, config?: Config): Promise<Voz> {
    const c = config ?? (await this.config());
    const propia = await this.a.kv.get<string>(`voz:${idEntrada(coleccion, slug)}`);
    return (propia && (await this.voz(propia))) || (await this.voz(c.voz)) || VOCES_INICIALES[0]!;
  }

  async tomasDe(coleccion: string, slug: string) {
    return todas(this.a.tomas, { coleccion, slug });
  }

  /**
   * Encola la narración de un texto. Idempotente: con la misma huella y voz no crea otra toma si ya hay una viva o
   * publicada. Si ese texto con esa voz ya tiene audio (en cualquier entrada), lo reutiliza sin pagar.
   */
  async encolar(e: {
    coleccion: string; slug: string; titulo: string; bloques: string[]; huella: string; voz: Voz; origen: Origen;
    costoEstimadoUsd: number; lote?: string; forzar?: boolean;
  }): Promise<ResultadoEncolar> {
    if (!/^[a-z0-9][a-z0-9-]{0,120}$/.test(e.slug) || !/^[a-z0-9_-]{1,64}$/.test(e.coleccion)) throw Error("Identificador inválido");
    if (!e.bloques.length) throw Error("La entrada no tiene texto narrable");
    const perfil = perfilDeVoz(e.voz);
    const perfilId = await idPerfil(perfil);
    const previas = await this.tomasDe(e.coleccion, e.slug);
    const t = this.ahora();
    const mismas = previas.filter((p) => p.data.huella === e.huella && p.data.perfilId === perfilId);
    const viva = mismas.find((p) => VIVOS.includes(p.data.estado));
    // Las tomas sin publicar de otro texto u otra voz ya no sirven.
    for (const p of previas)
      if ((p.data.huella !== e.huella || p.data.perfilId !== perfilId) && SIN_PUBLICAR.includes(p.data.estado))
        await this.a.tomas.put(p.id, { ...p.data, estado: "obsoleta", actualizado: t });
    // Volver a publicar una entrada retirada repone su audio al momento si el texto y la voz no cambiaron.
    const retirada = mismas.find((p) => p.data.estado === "retirada" && p.data.archivo);
    if (retirada && !e.forzar && !(await this.a.publicadas.get(idEntrada(e.coleccion, e.slug)))) {
      await this.a.tomas.put(retirada.id, { ...retirada.data, estado: "revision", actualizado: t });
      await this.publicar(retirada.id, retirada.data.revisor ?? "reutilizada");
      return { resultado: "vigente" };
    }
    if (viva && !e.forzar) {
      if (viva.data.estado === "publicada") return { resultado: "vigente" };
      return { resultado: "existente", id: viva.id, toma: viva.data };
    }
    const numero = previas.filter((p) => p.data.huella === e.huella && p.data.perfilId === perfilId)
      .reduce((m, p) => Math.max(m, p.data.numero + 1), 0);
    const base: Toma = {
      coleccion: e.coleccion, slug: e.slug, titulo: e.titulo.slice(0, 200), huella: e.huella, perfil, perfilId, numero,
      estado: "pendiente", bloques: e.bloques, origen: e.origen, ...(e.lote ? { lote: e.lote } : {}), intentos: 0,
      reintentarDesde: 0, costoEstimadoUsd: e.costoEstimadoUsd, creado: t, actualizado: t,
    };
    const id = idToma(base);
    // Caché: el mismo texto con la misma voz ya se narró (p. ej. despublicar y volver a publicar).
    if (!e.forzar) {
      const conAudio = (await todas(this.a.tomas, { huella: e.huella, perfilId }))
        .find((p) => p.data.archivo && p.data.url && ["publicada", "reemplazada", "retirada", "revision"].includes(p.data.estado));
      if (conAudio) {
        const c = conAudio.data;
        const toma: Toma = { ...base, estado: "revision", archivo: c.archivo, url: c.url, deposito: c.deposito, segundos: c.segundos,
          bytes: c.bytes, sha256: c.sha256, costoUsd: 0, informe: { ...c.informe, reutilizadaDe: conAudio.id } };
        await this.a.tomas.put(id, toma);
        const config = await this.config();
        const final = config.revision === "automatica" && c.estado !== "revision" ? await this.publicar(id, "reutilizada") : toma;
        return { resultado: "nuevo", id, toma: final, reutilizada: true };
      }
    }
    await this.a.tomas.put(id, base);
    return { resultado: "nuevo", id, toma: base, reutilizada: false };
  }

  /** Reclama hasta `limite` tomas pendientes listas para generarse, sin carreras entre procesos. */
  async reclamar(limite: number): Promise<{ id: string; toma: Toma }[]> {
    const t = this.ahora();
    for (const g of await todas(this.a.tomas, { estado: "generando" }))
      if (g.data.actualizado < t - GENERACION_MAXIMA_MS)
        await this.a.tomas.put(g.id, { ...g.data, estado: "pendiente", actualizado: t, error: "Generación interrumpida; vuelve a la cola" });
    const pendientes = (await todas(this.a.tomas, { estado: "pendiente" }, { creado: "asc" }))
      .filter((p) => p.data.reintentarDesde <= t)
      // Primero lo que se acaba de publicar; después el lote.
      .sort((x, y) => Number(x.data.origen === "lote") - Number(y.data.origen === "lote") || x.data.creado - y.data.creado);
    const reclamadas: { id: string; toma: Toma }[] = [];
    for (const p of pendientes) {
      if (reclamadas.length >= limite) break;
      const v = await this.a.tomas.getVersioned(p.id);
      if (!v || v.value.estado !== "pendiente") continue;
      const toma: Toma = { ...v.value, estado: "generando", intentos: v.value.intentos + 1, actualizado: t };
      if ((await this.a.tomas.compareAndSet(p.id, v.revision, toma)).applied) reclamadas.push({ id: p.id, toma });
    }
    return reclamadas;
  }

  /** Audio listo: queda en revisión o, con revisión automática y controles en verde, publicado. */
  async entregar(id: string, datos: Pick<Toma, "archivo" | "url" | "deposito" | "segundos" | "bytes" | "sha256" | "costoUsd" | "informe">,
    publicarSiPuede: boolean): Promise<Toma> {
    const toma = await this.a.tomas.get(id);
    if (!toma || toma.estado !== "generando") throw Error("La toma ya no está en generación (el texto pudo cambiar).");
    await this.a.tomas.put(id, { ...toma, ...datos, estado: "revision", error: undefined, actualizado: this.ahora() });
    return publicarSiPuede ? this.publicar(id, "automática") : (await this.a.tomas.get(id))!;
  }

  /** Publica una toma: su audio pasa a sonar en la entrada y la publicada anterior queda reemplazada. */
  async publicar(id: string, revisor: string): Promise<Toma> {
    const toma = await this.a.tomas.get(id);
    if (!toma || toma.estado !== "revision" || !toma.archivo || !toma.url || !toma.deposito)
      throw Error("Solo se puede publicar una toma en revisión con audio.");
    const clave = idEntrada(toma.coleccion, toma.slug);
    const anterior = await this.a.publicadas.get(clave);
    const t = this.ahora();
    if (anterior && anterior.toma !== id) {
      const vieja = await this.a.tomas.get(anterior.toma);
      if (vieja?.estado === "publicada") await this.a.tomas.put(anterior.toma, { ...vieja, estado: "reemplazada", actualizado: t });
    }
    const final: Toma = { ...toma, estado: "publicada", revisor: revisor.slice(0, 200), actualizado: t };
    await this.a.tomas.put(id, final);
    await this.a.publicadas.put(clave, {
      toma: id, coleccion: toma.coleccion, slug: toma.slug, huella: toma.huella, perfilId: toma.perfilId, vozId: toma.perfil.vozId,
      proveedor: toma.perfil.proveedor, voz: toma.perfil.voz,
      url: toma.url, archivo: toma.archivo, deposito: toma.deposito, segundos: Math.round(toma.segundos ?? 0), bytes: toma.bytes ?? 0, publicada: t,
    });
    await Promise.resolve(this.avisar()).catch(() => undefined);
    return final;
  }

  async rechazar(id: string, revisor: string, nota: string): Promise<Toma> {
    const toma = await this.a.tomas.get(id);
    if (!toma || toma.estado !== "revision") throw Error("Solo se puede rechazar una toma en revisión.");
    const final: Toma = { ...toma, estado: "rechazada", revisor: revisor.slice(0, 200), error: nota.slice(0, 500), actualizado: this.ahora() };
    await this.a.tomas.put(id, final);
    return final;
  }

  /** Fallo de una toma. `pausa`: el proveedor no está disponible (saldo, clave): vuelve a la cola sin gastar intento. */
  async fallar(id: string, motivo: string, opciones: { definitivo?: boolean; pausa?: boolean } = {}) {
    const toma = await this.a.tomas.get(id);
    if (!toma || toma.estado !== "generando") return;
    const t = this.ahora();
    if (opciones.pausa) {
      await this.a.tomas.put(id, { ...toma, estado: "pendiente", intentos: Math.max(0, toma.intentos - 1), error: motivo.slice(0, 500), actualizado: t });
      return;
    }
    const agotada = opciones.definitivo || toma.intentos >= INTENTOS;
    await this.a.tomas.put(id, {
      ...toma, estado: agotada ? "error" : "pendiente", error: motivo.slice(0, 500), actualizado: t,
      reintentarDesde: agotada ? 0 : t + (ESPERAS_MS[toma.intentos - 1] ?? ESPERAS_MS.at(-1)!),
    });
  }

  /** Despublicar o borrar la entrada: deja de sonar. El audio se conserva para reutilizarlo si vuelve. */
  async retirar(coleccion: string, slug: string) {
    const clave = idEntrada(coleccion, slug);
    const p = await this.a.publicadas.get(clave);
    if (!p) return false;
    const toma = await this.a.tomas.get(p.toma);
    if (toma) await this.a.tomas.put(p.toma, { ...toma, estado: "retirada", actualizado: this.ahora() });
    await this.a.publicadas.delete(clave);
    await Promise.resolve(this.avisar()).catch(() => undefined);
    return true;
  }

  /** Pide otra toma del mismo texto y perfil (regenerar). */
  async otraToma(id: string): Promise<{ id: string; toma: Toma }> {
    const toma = await this.a.tomas.get(id);
    if (!toma) throw Error("Toma desconocida.");
    if (toma.estado === "revision") await this.a.tomas.put(id, { ...toma, estado: "rechazada", actualizado: this.ahora() });
    const previas = await this.tomasDe(toma.coleccion, toma.slug);
    const numero = previas.filter((p) => p.data.huella === toma.huella && p.data.perfilId === toma.perfilId)
      .reduce((m, p) => Math.max(m, p.data.numero + 1), 0);
    const t = this.ahora();
    const nueva: Toma = {
      ...toma, numero, estado: "pendiente", origen: "panel", intentos: 0, reintentarDesde: 0, creado: t, actualizado: t,
      archivo: undefined, url: undefined, deposito: undefined, segundos: undefined, bytes: undefined, sha256: undefined,
      costoUsd: undefined, informe: undefined, error: undefined, revisor: undefined, lote: undefined,
    };
    const nuevoId = idToma(nueva);
    await this.a.tomas.put(nuevoId, nueva);
    return { id: nuevoId, toma: nueva };
  }

  // ---- Gasto ------------------------------------------------------------------------------------

  async gasto(mes = mesDe(this.ahora())) {
    return (await this.a.kv.get<{ usd: number; tomas: number }>(`gasto:${mes}`)) ?? { usd: 0, tomas: 0 };
  }

  async sumarGasto(usd: number) {
    const clave = `gasto:${mesDe(this.ahora())}`;
    for (let i = 0; i < 5; i++) {
      const v = await this.a.kv.getVersioned<{ usd: number; tomas: number }>(clave);
      const actual = v?.value ?? { usd: 0, tomas: 0 };
      const nuevo = { usd: Math.round((actual.usd + usd) * 1e6) / 1e6, tomas: actual.tomas + 1 };
      if ((await this.a.kv.compareAndSet(clave, v?.revision ?? null, nuevo)).applied) return nuevo;
    }
    throw Error("No se pudo registrar el gasto");
  }

  // ---- Disyuntor y cerrojo ----------------------------------------------------------------------

  async disyuntor(proveedor: string) {
    const d = await this.a.kv.get<{ hasta: number; motivo: string }>(`disyuntor:${proveedor}`);
    return d && d.hasta > this.ahora() ? d : null;
  }

  async abrirDisyuntor(proveedor: string, motivo: string, ms = 6 * 3600_000) {
    await this.a.kv.set(`disyuntor:${proveedor}`, { hasta: this.ahora() + ms, motivo: motivo.slice(0, 300) });
  }

  async cerrarDisyuntor(proveedor: string) {
    await this.a.kv.delete(`disyuntor:${proveedor}`);
  }

  /** Cerrojo con caducidad: un solo trabajador a la vez, aunque haya varios procesos. */
  async tomarCerrojo(dueno: string, ms = GENERACION_MAXIMA_MS): Promise<boolean> {
    const v = await this.a.kv.getVersioned<{ dueno: string; hasta: number }>("cerrojo");
    if (v && v.value.hasta > this.ahora() && v.value.dueno !== dueno) return false;
    return (await this.a.kv.compareAndSet("cerrojo", v?.revision ?? null, { dueno, hasta: this.ahora() + ms })).applied;
  }

  async soltarCerrojo(dueno: string) {
    const v = await this.a.kv.getVersioned<{ dueno: string; hasta: number }>("cerrojo");
    if (v?.value.dueno === dueno) await this.a.kv.delete("cerrojo");
  }

  // ---- Panel ------------------------------------------------------------------------------------

  async resumen() {
    const estados: Estado[] = ["pendiente", "generando", "revision", "publicada", "error", "rechazada", "obsoleta", "reemplazada", "retirada"];
    const cuenta: Partial<Record<Estado, number>> = {};
    for (const e of estados) cuenta[e] = await this.a.tomas.count({ estado: e });
    return cuenta;
  }

  async lista(limite = 200) {
    return (await this.a.tomas.query({ orderBy: { actualizado: "desc" }, limit: Math.min(100, limite) })).items;
  }

  async publicadasTodas() {
    return todas(this.a.publicadas, {});
  }
}

/** Almacén en memoria con la misma semántica (pruebas y herramientas locales). */
export function almacenEnMemoria(): Almacen {
  let rev = 0;
  function coleccion<T>(): Coleccion<T> {
    const filas = new Map<string, { data: T; revision: string }>();
    const coincide = (d: T, where?: Record<string, unknown>) =>
      !where || Object.entries(where).every(([k, v]) => (d as Record<string, unknown>)[k] === v);
    return {
      async get(id) { return filas.get(id)?.data ?? null; },
      async put(id, data) { filas.set(id, { data: structuredClone(data), revision: String(++rev) }); },
      async delete(id) { return filas.delete(id); },
      async getVersioned(id) { const f = filas.get(id); return f ? { value: structuredClone(f.data), revision: f.revision } : null; },
      async compareAndSet(id, expected, data) {
        const f = filas.get(id);
        if ((f?.revision ?? null) !== expected) return { applied: false };
        filas.set(id, { data: structuredClone(data), revision: String(++rev) });
        return { applied: true };
      },
      async query(o = {}) {
        let items = [...filas].filter(([, f]) => coincide(f.data, o.where)).map(([id, f]) => ({ id, data: structuredClone(f.data) }));
        const [campo, dir] = Object.entries(o.orderBy ?? {})[0] ?? [];
        if (campo) items.sort((a, b) => {
          const x = (a.data as Record<string, number>)[campo]!, y = (b.data as Record<string, number>)[campo]!;
          return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
        });
        const inicio = Number(o.cursor ?? 0), limite = o.limit ?? 50;
        return { items: items.slice(inicio, inicio + limite), hasMore: inicio + limite < items.length, cursor: String(inicio + limite) };
      },
      async count(where) { return [...filas.values()].filter((f) => coincide(f.data, where)).length; },
    };
  }
  const kv = coleccion<unknown>();
  return {
    tomas: coleccion(), publicadas: coleccion(), voces: coleccion(), permisos: coleccion(),
    kv: {
      get: async <T,>(k: string) => (await kv.get(k)) as T | null,
      set: (k, v) => kv.put(k, v),
      getVersioned: async <T,>(k: string) => (await kv.getVersioned(k)) as { value: T; revision: string } | null,
      compareAndSet: (k, e, v) => kv.compareAndSet(k, e, v),
      delete: (k) => kv.delete(k),
    },
  };
}
