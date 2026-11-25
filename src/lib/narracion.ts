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
}

const PLUGIN = 'sably-narracion';

export async function narracionVigente(coleccion: string, slug: string, datos: Record<string, unknown>): Promise<Narracion | undefined> {
  try {
    const { getDb } = await import('emdash/runtime');
    const fila = await (await getDb()).selectFrom('_plugin_storage' as never).select('data' as never)
      .where('plugin_id' as never, '=', PLUGIN as never).where('collection' as never, '=', 'publicadas' as never)
      .where('id' as never, '=', `${coleccion}:${slug}` as never).executeTakeFirst() as { data?: string } | undefined;
    if (!fila?.data) return undefined;
    const p = JSON.parse(fila.data) as { huella?: string; url?: string; segundos?: number; vozId?: string };
    if (!p.huella || !p.url || !p.segundos) return undefined;
    // La huella depende de si el ajuste incluía las preguntas frecuentes: vale cualquiera de las dos lecturas.
    const sin = await huella(bloquesDe(coleccion, datos, { incluirPreguntas: false }));
    const con = Array.isArray(datos.faq) && datos.faq.length ? await huella(bloquesDe(coleccion, datos, { incluirPreguntas: true })) : sin;
    if (p.huella !== sin && p.huella !== con) return undefined;
    return { url: p.url, segundos: Math.round(p.segundos), vozId: p.vozId ?? '' };
  } catch {
    return undefined;
  }
}

/** Duración ISO 8601 (PT4M12S) para AudioObject. */
export const duracionIso = (segundos: number) => `PT${Math.floor(segundos / 60)}M${Math.round(segundos % 60)}S`;
