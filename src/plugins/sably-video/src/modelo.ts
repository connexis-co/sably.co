/**
 * Modelo de la biblioteca de vídeo (plugin «sably-video»). Diseño en docs/equipo/2026-11-25/video/DISENO.md (carpeta
 * sably.co). Todo lo de aquí es puro (sin red ni base de datos) para poder probarlo.
 *
 * - `videos`: un vídeo, con su original y su MP4 web en R2 (la fuente de verdad: R2 nunca se borra).
 * - `copias`: la copia de un vídeo en un proveedor de streaming (hoy Mux), con su estado.
 * - `usos`: dónde se pinta cada vídeo (`curso:<slug>`).
 */
export const pluginId = 'sably-video';

export const ALMACENAMIENTO = {
  videos: { indexes: ['creado'] },
  copias: { indexes: ['video', 'proveedor', 'externoId', 'estado'] },
  usos: { indexes: ['video'] },
} as const;

export const CDN = 'https://cdn.sably.co';

export interface Video {
  titulo: string;
  /** Clave en R2 del original tal como se descargó (videos/originales/<id>.mp4). */
  original: string;
  /** Clave en R2 de la versión editada a calidad de origen (sin cortinillas de marca), si la hay. Es la que va a Mux. */
  editado?: string;
  /** Clave en R2 del MP4 web con caché larga, si existe (videos/web2/<id>.mp4). */
  web?: string;
  segundos: number;
  ancho?: number;
  alto?: number;
  /** De dónde salió (URL de YouTube, Hotmart…): para saber qué es de quién. */
  origen?: string;
  creado: number;
}

export type EstadoCopia = 'preparando' | 'lista' | 'error' | 'borrada';

export interface Copia {
  video: string;
  proveedor: 'mux';
  externoId: string;
  playbackId?: string;
  estado: EstadoCopia;
  /** Pista de subtítulos generada (id de Mux), si ya está lista. */
  subtitulos?: string;
  /** Hay MP4 de 720p del proveedor (respaldo para navegadores sin HLS nativo). */
  mp4?: boolean;
  segundos?: number;
  resolucion?: string;
  error?: string;
  actualizado: number;
}

export interface Uso { video: string }

export interface Config {
  /** Desde dónde se sirve al público: «r2» = MP4 de R2 (como hasta ahora); «mux» = HLS de Mux si la copia está lista. */
  entrega: 'r2' | 'mux';
  /** Calidad con la que se piden las copias nuevas a Mux. */
  calidad: 'basic' | 'plus' | 'premium';
  /** Aviso en el panel cuando el gasto estimado del mes pasa de esta cifra. */
  alertaUsd: number;
}

export const CONFIG_INICIAL: Config = { entrega: 'r2', calidad: 'premium', alertaUsd: 5 };

export function normalizarConfig(c: Partial<Config> | null | undefined): Config {
  const base = { ...CONFIG_INICIAL, ...(c ?? {}) };
  return {
    entrega: base.entrega === 'mux' ? 'mux' : 'r2',
    calidad: (['basic', 'plus', 'premium'] as const).includes(base.calidad) ? base.calidad : 'premium',
    alertaUsd: Number.isFinite(Number(base.alertaUsd)) && Number(base.alertaUsd) >= 0 ? Number(base.alertaUsd) : CONFIG_INICIAL.alertaUsd,
  };
}

/** Lo que necesita el reproductor público. */
export interface Fuentes {
  /** MP4 que siempre funciona (R2 web, o el 720p de Mux si no hay copia web en R2). */
  mp4: string;
  /** HLS adaptativo, solo con entrega «mux» y copia lista. El reproductor lo usa si el navegador lo admite. */
  hls?: string;
  subtitulos?: string;
  poster?: string;
  storyboard?: string;
  segundos: number;
  proveedor: 'r2' | 'mux';
  /** La URL que va al VideoObject: siempre el MP4 de R2 si existe (estable aunque cambie el proveedor). */
  contentUrl: string;
}

const muxStream = (p: string) => `https://stream.mux.com/${p}`;

/**
 * Elige las fuentes públicas de un vídeo. Regla: R2 es el respaldo y nunca se pierde. Mux solo entra con entrega «mux»
 * y la copia «lista»; si la copia no está, se borra o falla, la página vuelve al MP4 de R2 sin tocar nada más.
 */
export function fuentesDe(video: Video, copias: Copia[], config: Pick<Config, 'entrega'>): Fuentes | undefined {
  const r2 = video.web ? `${CDN}/${video.web}` : undefined;
  const copia = config.entrega === 'mux' ? copias.find((c) => c.proveedor === 'mux' && c.estado === 'lista' && c.playbackId) : undefined;
  if (copia?.playbackId) {
    const p = copia.playbackId;
    const mp4 = r2 ?? (copia.mp4 ? `${muxStream(p)}/720p.mp4` : undefined);
    if (!mp4) return undefined;
    return {
      mp4, hls: `${muxStream(p)}.m3u8`,
      ...(copia.subtitulos ? { subtitulos: `${muxStream(p)}/text/${copia.subtitulos}.vtt` } : {}),
      poster: `https://image.mux.com/${p}/thumbnail.webp?width=1200&time=1`,
      storyboard: `https://image.mux.com/${p}/storyboard.vtt`,
      segundos: Math.round(copia.segundos ?? video.segundos), proveedor: 'mux', contentUrl: r2 ?? mp4,
    };
  }
  if (!r2) return undefined;
  return { mp4: r2, segundos: Math.round(video.segundos), proveedor: 'r2', contentUrl: r2 };
}

/** Traduce un asset de la API de Mux a los campos de la copia. */
export function copiaDesdeMux(asset: Record<string, any>): Partial<Copia> {
  const estado: EstadoCopia = asset.status === 'ready' ? 'lista' : asset.status === 'errored' ? 'error' : 'preparando';
  const pistas = Array.isArray(asset.tracks) ? asset.tracks : [];
  const texto = pistas.find((t: any) => t.type === 'text' && t.status === 'ready' && String(t.language_code ?? '').startsWith('es'));
  const renditions = asset.static_renditions?.files ?? asset.static_renditions ?? [];
  const mp4 = Array.isArray(renditions) && renditions.some((f: any) => (f.name === '720p.mp4' || f.resolution === '720p') && (f.status ?? 'ready') === 'ready');
  return {
    estado,
    playbackId: asset.playback_ids?.find((p: any) => p.policy === 'public')?.id ?? asset.playback_ids?.[0]?.id,
    ...(texto ? { subtitulos: texto.id } : {}),
    mp4,
    ...(Number.isFinite(asset.duration) ? { segundos: asset.duration } : {}),
    ...(asset.resolution_tier ? { resolucion: asset.resolution_tier } : {}),
    ...(estado === 'error' ? { error: String(asset.errors?.messages?.join(' ') ?? asset.errors?.type ?? 'Mux no pudo procesar el vídeo').slice(0, 300) } : {}),
  };
}

/** Precios de Mux en pago por uso (mux.com/docs/pricing/video, leídos el 25-nov-2026), primer tramo, por minuto. */
export const PRECIOS_MUX = {
  entrada: { basic: { '1080p': 0, '2160p': 0 }, plus: { '1080p': 0.03125, '2160p': 0.1 }, premium: { '1080p': 0.046875, '2160p': 0.15 } },
  almacenamiento: { basic: { '1080p': 0.003, '2160p': 0.0096 }, plus: { '1080p': 0.003, '2160p': 0.0096 }, premium: { '1080p': 0.0045, '2160p': 0.0144 } },
} as const;

/** Coste estimado de las copias en Mux: codificación (una vez) y almacenamiento (al mes, todo «caliente»). */
export function costeMux(copias: { segundos?: number; resolucion?: string }[], calidad: Config['calidad']) {
  let entrada = 0;
  let mes = 0;
  for (const c of copias) {
    const min = (c.segundos ?? 0) / 60;
    const tier = /2160|4k/i.test(c.resolucion ?? '') ? '2160p' : '1080p';
    entrada += min * PRECIOS_MUX.entrada[calidad][tier];
    mes += min * PRECIOS_MUX.almacenamiento[calidad][tier];
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { entradaUsd: r(entrada), almacenamientoMesUsd: r(mes) };
}

/**
 * Verifica la cabecera `mux-signature` (t=<unix>,v1=<hmac-sha256 hex de "t.cuerpo">) con el secreto del webhook.
 * Rechaza firmas de más de 5 minutos para que no se pueda repetir una petición vieja.
 */
export async function firmaMuxValida(cabecera: string | null | undefined, cuerpo: string, secreto: string, ahora = Date.now()) {
  if (!cabecera || !secreto) return false;
  const partes = Object.fromEntries(cabecera.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
  const t = Number(partes.t);
  if (!partes.v1 || !Number.isFinite(t) || Math.abs(ahora / 1000 - t) > 300) return false;
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${partes.t}.${cuerpo}`)));
  const esperada = [...firma].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (esperada.length !== partes.v1.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperada.length; i++) diferencia |= esperada.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  return diferencia === 0;
}

/** Id de vídeo válido: el slug del curso u otro nombre corto en minúsculas. */
export const ID_VIDEO = /^[a-z0-9][a-z0-9-]{1,120}$/;
