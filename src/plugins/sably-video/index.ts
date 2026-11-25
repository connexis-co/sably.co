// Plugin de EmDash «sably-video»: biblioteca de vídeos con el original en R2 y copias en proveedores de streaming
// (hoy Mux). Panel «Sably · vídeo». Diseño en docs/equipo/2026-11-25/video/DISENO.md (carpeta sably.co).
// Regla: R2 es la fuente de verdad y el respaldo; si Mux falla o se borra la copia, la página vuelve al MP4 de R2.
import { definePlugin, PluginRouteError, type PluginContext, type PluginRoute, type RouteContext } from 'emdash';
import { ALMACENAMIENTO, CDN, CONFIG_INICIAL, ID_VIDEO, copiaDesdeMux, costeMux, firmaMuxValida, fuentesDe, normalizarConfig, pluginId, type Config, type Copia, type Uso, type Video } from './src/modelo';
import { clienteMux, credencialesMux, ErrorMux } from './src/mux';
import { semilla } from './src/semilla';

export { pluginId };
export const pluginVersion = '1.0.0';

interface Coleccion<T> {
  get(id: string): Promise<T | null>;
  put(id: string, data: T): Promise<void>;
  delete?(id: string): Promise<unknown>;
  query(o: { where?: Record<string, unknown>; limit?: number; cursor?: string }): Promise<{ items: { id: string; data: T }[]; cursor?: string; hasMore?: boolean }>;
}
interface Almacen { videos: Coleccion<Video>; copias: Coleccion<Copia>; usos: Coleccion<Uso> }
const almacen = (ctx: Pick<PluginContext, 'storage'>) => ctx.storage as unknown as Almacen;

async function todos<T>(c: Coleccion<T>, where?: Record<string, unknown>) {
  const salida: { id: string; data: T }[] = [];
  let cursor: string | undefined;
  do {
    const p = await c.query({ where, limit: 100, cursor });
    salida.push(...p.items);
    cursor = p.hasMore ? p.cursor : undefined;
  } while (cursor);
  return salida;
}

const config = async (ctx: Pick<PluginContext, 'kv'>) => normalizarConfig(await ctx.kv.get<Partial<Config>>('config'));

/** Que el cambio se vea sin esperar a que caduque la copia de la página (solo Node). */
async function invalidarPaginas() {
  if (process.env.SABLY_RUNTIME !== 'node') return;
  const { invalidateNodePages } = await import('../../lib/node/cache-provider');
  invalidateNodePages();
}

function mux() {
  const cred = credencialesMux();
  if (!cred) throw PluginRouteError.badRequest('Faltan MUX_TOKEN_ID y MUX_TOKEN_SECRET en el servidor.');
  return clienteMux(cred);
}

/** Pide el estado a Mux y lo guarda. Devuelve la copia actualizada. */
async function sincronizarCopia(ctx: PluginContext, id: string, copia: Copia) {
  try {
    const asset = await mux().asset(copia.externoId);
    const nueva: Copia = { ...copia, ...copiaDesdeMux(asset), actualizado: Date.now() };
    await almacen(ctx).copias.put(id, nueva);
    if (nueva.estado !== copia.estado || nueva.subtitulos !== copia.subtitulos) await invalidarPaginas();
    return nueva;
  } catch (e) {
    if (e instanceof ErrorMux && e.estado === 404) {
      const borrada: Copia = { ...copia, estado: 'borrada', actualizado: Date.now() };
      await almacen(ctx).copias.put(id, borrada);
      await invalidarPaginas();
      return borrada;
    }
    throw e;
  }
}

async function sincronizarPendientes(ctx: PluginContext) {
  if (!credencialesMux()) return 0;
  let n = 0;
  for (const { id, data } of await todos(almacen(ctx).copias, { estado: 'preparando' })) {
    await sincronizarCopia(ctx, id, data).catch((e: Error) => ctx.log.warn('No se pudo consultar Mux', { id, error: e.message }));
    n++;
  }
  return n;
}

/** Título de cada curso por slug (una pasada por la colección). */
async function titulosDeCursos(ctx: PluginContext) {
  const mapa = new Map<string, string>();
  if (!ctx.content) return mapa;
  let cursor: string | undefined;
  try {
    do {
      const pagina = await ctx.content.list('courses', { limit: 100, cursor } as never);
      for (const item of pagina.items as { slug?: string; data?: { title?: unknown } }[]) {
        if (item.slug && typeof item.data?.title === 'string') mapa.set(item.slug, item.data.title);
      }
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);
  } catch { /* sin títulos: se usa el genérico */ }
  return mapa;
}

const entrada = (ctx: RouteContext) => (ctx.input ?? {}) as Record<string, unknown>;
const idVideo = (v: unknown) => {
  if (typeof v !== 'string' || !ID_VIDEO.test(v)) throw PluginRouteError.badRequest('Vídeo no válido.');
  return v;
};

function ruta(permission: 'content:publish_any' | 'settings:manage', method: 'GET' | 'POST', handler: (ctx: RouteContext) => Promise<unknown>): PluginRoute {
  return {
    methods: [method], permission, public: false,
    request: { body: method === 'GET' ? 'none' : 'json', ...(method === 'POST' ? { maxBytes: 16_384 } : {}) },
    handler: async (ctx: RouteContext) => {
      try { return await handler(ctx); } catch (e) {
        if (e instanceof PluginRouteError) throw e;
        throw PluginRouteError.badRequest((e as Error).message ?? 'No se pudo completar.');
      }
    },
  } as PluginRoute;
}

function cabecera(ctx: RouteContext, nombre: string) {
  const h = (ctx.request as unknown as { headers: Headers | Record<string, string> }).headers;
  return typeof (h as Headers).get === 'function' ? (h as Headers).get(nombre) : (h as Record<string, string>)[nombre] ?? null;
}

export function createPlugin() {
  return definePlugin({
    id: pluginId,
    version: pluginVersion,
    capabilities: ['content:read'],
    storage: ALMACENAMIENTO as never,
    admin: { pages: [{ path: '/video', label: 'Vídeo', icon: 'video' }] },
    hooks: {
      'plugin:activate': async (_event, ctx) => {
        await ctx.cron?.schedule('video-sincronizar', { schedule: '*/10 * * * *' });
        if (!(await ctx.kv.get('config'))) await ctx.kv.set('config', CONFIG_INICIAL);
      },
      cron: async (event, ctx) => {
        if (event.name !== 'video-sincronizar') return;
        const n = await sincronizarPendientes(ctx);
        if (n) ctx.log.info('Copias de vídeo consultadas', { n });
      },
    },
    routes: {
      estado: ruta('content:publish_any', 'GET', async (ctx) => {
        const a = almacen(ctx);
        const [videos, copias, usos, cfg] = await Promise.all([todos(a.videos), todos(a.copias), todos(a.usos), config(ctx)]);
        const vivas = copias.filter((c) => c.data.estado !== 'borrada').map((c) => c.data);
        return {
          config: cfg,
          mux: Boolean(credencialesMux()), webhook: Boolean(process.env.MUX_WEBHOOK_SECRET),
          coste: costeMux(vivas, cfg.calidad),
          videos: videos.map(({ id, data }) => {
            const suyas = copias.filter((c) => c.data.video === id).map((c) => ({ id: c.id, ...c.data }));
            return {
              id, ...data, copias: suyas,
              usos: usos.filter((u) => u.data.video === id).map((u) => u.id),
              original: `${CDN}/${data.original}`, web: data.web ? `${CDN}/${data.web}` : null,
              publico: fuentesDe(data, suyas, cfg) ?? null,
            };
          }),
        };
      }),
      ajustes: ruta('settings:manage', 'POST', async (ctx) => {
        const nueva = normalizarConfig({ ...(await config(ctx)), ...(entrada(ctx) as Partial<Config>) });
        await ctx.kv.set('config', nueva);
        await invalidarPaginas();
        return nueva;
      }),
      /** Da de alta los vídeos que ya están en R2 (semilla.ts) y los asigna a su curso. No sobrescribe los existentes. */
      sembrar: ruta('settings:manage', 'POST', async (ctx) => {
        const a = almacen(ctx);
        const titulos = await titulosDeCursos(ctx);
        const nuevos: string[] = [];
        for (const [id, video] of Object.entries(semilla())) {
          const titulo = titulos.get(id) ?? video.titulo;
          const actual = await a.videos.get(id);
          if (actual) {
            // Corrige el título genérico de una siembra anterior; no toca uno puesto a mano.
            if (actual.titulo === video.titulo && titulo !== video.titulo) await a.videos.put(id, { ...actual, titulo });
            continue;
          }
          await a.videos.put(id, { ...video, titulo });
          if (!(await a.usos.get(`curso:${id}`))) await a.usos.put(`curso:${id}`, { video: id });
          nuevos.push(id);
        }
        await invalidarPaginas();
        return { nuevos };
      }),
      asignar: ruta('content:publish_any', 'POST', async (ctx) => {
        const i = entrada(ctx);
        const curso = idVideo(i.curso);
        const a = almacen(ctx);
        if (i.video === null) { await a.usos.delete?.(`curso:${curso}`); await invalidarPaginas(); return { ok: true }; }
        const video = idVideo(i.video);
        if (!(await a.videos.get(video))) throw PluginRouteError.notFound('Ese vídeo no está en la biblioteca.');
        await a.usos.put(`curso:${curso}`, { video });
        await invalidarPaginas();
        return { ok: true };
      }),
      /** Crea la copia en Mux desde el original de R2 (Mux lo descarga él mismo). */
      'enviar-mux': ruta('settings:manage', 'POST', async (ctx) => {
        const id = idVideo(entrada(ctx).video);
        const a = almacen(ctx);
        const video = await a.videos.get(id);
        if (!video) throw PluginRouteError.notFound('Ese vídeo no está en la biblioteca.');
        const ya = (await todos(a.copias, { video: id })).find((c) => c.data.proveedor === 'mux' && c.data.estado !== 'borrada' && c.data.estado !== 'error');
        if (ya) throw PluginRouteError.badRequest('Ese vídeo ya tiene copia en Mux.');
        const cfg = await config(ctx);
        const asset = await mux().importar(`${CDN}/${video.original}`, id, cfg.calidad);
        const copia: Copia = { video: id, proveedor: 'mux', externoId: asset.id, estado: 'preparando', ...copiaDesdeMux(asset), actualizado: Date.now() } as Copia;
        await a.copias.put(`${id}:mux`, copia);
        return copia;
      }),
      /** Enlaza assets que ya existen en Mux (creados por el guion de migración) por su `passthrough`. */
      'enlazar-mux': ruta('settings:manage', 'POST', async (ctx) => {
        const a = almacen(ctx);
        const enlazados: string[] = [];
        for (const asset of await mux().todos()) {
          const id = asset.passthrough;
          if (typeof id !== 'string' || !(await a.videos.get(id))) continue;
          const actual = await a.copias.get(`${id}:mux`);
          if (actual && actual.estado !== 'borrada' && actual.externoId === asset.id) continue;
          await a.copias.put(`${id}:mux`, { video: id, proveedor: 'mux', externoId: asset.id, ...copiaDesdeMux(asset), actualizado: Date.now() } as Copia);
          enlazados.push(id);
        }
        await invalidarPaginas();
        return { enlazados };
      }),
      sincronizar: ruta('content:publish_any', 'POST', async (ctx) => {
        const a = almacen(ctx);
        let n = 0;
        for (const { id, data } of await todos(a.copias)) {
          if (data.estado === 'borrada') continue;
          await sincronizarCopia(ctx, id, data);
          n++;
        }
        return { consultadas: n };
      }),
      'borrar-copia': ruta('settings:manage', 'POST', async (ctx) => {
        const id = `${idVideo(entrada(ctx).video)}:mux`;
        const a = almacen(ctx);
        const copia = await a.copias.get(id);
        if (!copia) throw PluginRouteError.notFound('No hay copia en Mux.');
        await mux().borrar(copia.externoId).catch((e) => { if (!(e instanceof ErrorMux && e.estado === 404)) throw e; });
        await a.copias.put(id, { ...copia, estado: 'borrada', actualizado: Date.now() });
        await invalidarPaginas();
        return { ok: true };
      }),
      /** Webhook de Mux (público, con firma). Configurar en Mux: https://sably.co/_emdash/api/plugins/sably-video/mux */
      mux: {
        methods: ['POST'], public: true, request: { body: 'text', maxBytes: 262_144 },
        handler: async (ctx: RouteContext) => {
          const cuerpo = String(ctx.input ?? '');
          if (!(await firmaMuxValida(cabecera(ctx, 'mux-signature'), cuerpo, process.env.MUX_WEBHOOK_SECRET ?? '')))
            throw PluginRouteError.unauthorized('Firma no válida.');
          const evento = JSON.parse(cuerpo) as { type?: string; object?: { type?: string; id?: string }; data?: { id?: string; asset_id?: string } };
          const assetId = evento.object?.type === 'asset' ? evento.object.id : evento.data?.asset_id ?? evento.data?.id;
          if (!assetId) return { ok: true };
          const hit = (await todos(almacen(ctx).copias, { externoId: assetId }))[0];
          if (hit) await sincronizarCopia(ctx as unknown as PluginContext, hit.id, hit.data);
          return { ok: true };
        },
      } as PluginRoute,
    },
  });
}

export default createPlugin;
