/**
 * Cliente mínimo de la API de vídeo de Mux. Credenciales en el entorno del servidor: MUX_TOKEN_ID y MUX_TOKEN_SECRET
 * (token con solo el permiso «Mux Video»), y MUX_WEBHOOK_SECRET para el webhook. Nunca llegan al navegador.
 */
import type { Config } from './modelo';

export interface CredencialesMux { id: string; secreto: string }

export function credencialesMux(env: Record<string, string | undefined> = process.env): CredencialesMux | undefined {
  return env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET ? { id: env.MUX_TOKEN_ID, secreto: env.MUX_TOKEN_SECRET } : undefined;
}

export class ErrorMux extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

export function clienteMux(cred: CredencialesMux, f: typeof fetch = fetch) {
  const auth = 'Basic ' + btoa(`${cred.id}:${cred.secreto}`);
  async function llamar(ruta: string, init: RequestInit = {}) {
    const r = await f(`https://api.mux.com/video/v1${ruta}`, { ...init, headers: { authorization: auth, 'content-type': 'application/json' } });
    if (r.status === 204) return undefined;
    const cuerpo = (await r.json().catch(() => ({}))) as { data?: any; error?: { messages?: string[] } };
    if (!r.ok) throw new ErrorMux(r.status, cuerpo.error?.messages?.join(' ') ?? `Mux respondió ${r.status}`);
    return cuerpo.data;
  }
  return {
    /**
     * Crea un asset copiando el MP4 desde su URL pública (R2): nada pasa por el servidor. Pide reproducción pública,
     * resolución hasta 4K (no amplía), subtítulos automáticos en español y un MP4 de 720p de respaldo.
     */
    importar: (url: string, video: string, calidad: Config['calidad']) => llamar('/assets', {
      method: 'POST',
      body: JSON.stringify({
        inputs: [{ url, generated_subtitles: [{ language_code: 'es', name: 'Español' }] }],
        playback_policies: ['public'],
        video_quality: calidad,
        max_resolution_tier: '2160p',
        static_renditions: [{ resolution: '720p' }],
        passthrough: video,
        meta: { title: video, external_id: video },
      }),
    }),
    asset: (id: string) => llamar(`/assets/${encodeURIComponent(id)}`),
    borrar: (id: string) => llamar(`/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** Todos los assets (para enlazar los creados fuera del panel, p. ej. por el guion de migración). */
    async todos() {
      const lista: any[] = [];
      for (let page = 1; page < 50; page++) {
        const lote = (await llamar(`/assets?limit=100&page=${page}`)) as any[];
        lista.push(...lote);
        if (lote.length < 100) break;
      }
      return lista;
    },
  };
}

export type ClienteMux = ReturnType<typeof clienteMux>;
