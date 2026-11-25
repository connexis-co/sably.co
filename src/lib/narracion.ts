/**
 * Narración vigente de una entrada para la página pública. Lee la fila `publicadas` del plugin «sably-narracion»
 * (una consulta por clave primaria) y solo la devuelve si su huella coincide con el texto que se está mostrando:
 * nunca suena un audio de un texto distinto. Si algo falla, la página sigue sin reproductor.
 */
import { bloquesDe } from '@/plugins/sably-narracion/src/config';
import { huella } from '@/plugins/sably-narracion/src/texto';

export interface Narracion {
  url: string;
  segundos: number;
  vozId: string;
  /** Id de la voz del catálogo (p. ej. csagent-9), para la medición. Sin nombre de proveedor: va en el HTML público. */
  proveedor: string;
}

const PLUGIN = 'sably-narracion';

async function existeEnDisco(archivo: string) {
  if (process.env.SABLY_RUNTIME !== 'node') return false;
  const [{ stat }, { join, resolve }, { carpetaAudios }] = await Promise.all([
    import('node:fs/promises'), import('node:path'), import('@/plugins/sably-narracion/src/deposito'),
  ]);
  return stat(join(resolve(carpetaAudios()), archivo)).then((s) => s.isFile() && s.size > 0, () => false);
}

export async function narracionVigente(coleccion: string, slug: string, datos: Record<string, unknown>): Promise<Narracion | undefined> {
  try {
    const { getDb } = await import('emdash/runtime');
    const fila = await (await getDb()).selectFrom('_plugin_storage' as never).select('data' as never)
      .where('plugin_id' as never, '=', PLUGIN as never).where('collection' as never, '=', 'publicadas' as never)
      .where('id' as never, '=', `${coleccion}:${slug}` as never).executeTakeFirst() as { data?: string } | undefined;
    if (!fila?.data) return undefined;
    const p = JSON.parse(fila.data) as { huella?: string; url?: string; segundos?: number; vozId?: string; proveedor?: string; voz?: string };
    if (!p.huella || !p.url || !p.segundos) return undefined;
    // La huella depende de si el ajuste incluía las preguntas frecuentes: vale cualquiera de las dos lecturas.
    const sin = await huella(bloquesDe(coleccion, datos, { incluirPreguntas: false }));
    const con = Array.isArray(datos.faq) && datos.faq.length ? await huella(bloquesDe(coleccion, datos, { incluirPreguntas: true })) : sin;
    if (p.huella !== sin && p.huella !== con) return undefined;
    // Depósito en disco: si el archivo no está (copia restaurada sin la carpeta de audios), no hay reproductor roto.
    if (p.url.startsWith('/narraciones/') && !(await existeEnDisco(p.url.slice('/narraciones/'.length)))) return undefined;
    return { url: p.url, segundos: Math.round(p.segundos), vozId: p.vozId ?? '', proveedor: p.vozId ?? '' };
  } catch {
    return undefined;
  }
}

/**
 * Segundos de la narración publicada de cada entrada de una colección, en una sola consulta: para el distintivo
 * «Escúchalo · N min» de tarjetas y listados (blog/DISENO.md §12.11). No comprueba la huella: tras editar el texto, el
 * distintivo puede seguir visible el minuto o dos que tarda la toma nueva, mientras la ficha ya no pinta el reproductor.
 */
export async function duracionesNarradas(coleccion: string): Promise<Map<string, number>> {
  try {
    const { getDb } = await import('emdash/runtime');
    const filas = await (await getDb()).selectFrom('_plugin_storage' as never).select(['id', 'data'] as never)
      .where('plugin_id' as never, '=', PLUGIN as never).where('collection' as never, '=', 'publicadas' as never)
      .where('id' as never, 'like', `${coleccion}:%` as never).execute() as { id: string; data: string }[];
    const mapa = new Map<string, number>();
    for (const f of filas) {
      const segundos = Number((JSON.parse(f.data) as { segundos?: unknown }).segundos);
      if (segundos > 0) mapa.set(f.id.slice(coleccion.length + 1), Math.round(segundos));
    }
    return mapa;
  } catch {
    return new Map();
  }
}

/** Duración ISO 8601 (PT4M12S) para AudioObject. */
export const duracionIso = (segundos: number) => `PT${Math.floor(segundos / 60)}M${Math.round(segundos % 60)}S`;
