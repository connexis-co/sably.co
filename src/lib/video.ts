/**
 * Vídeo de un curso para la página pública, desde la biblioteca del plugin «sably-video». Tres consultas por clave
 * primaria (uso → vídeo → copias) y el ajuste de entrega. Si el plugin no está, no tiene el curso o algo falla,
 * devuelve `undefined` y la página sigue con lo de siempre (`videoKey` + COURSE_VIDEOS). Nunca rompe la ficha.
 */
import { fuentesDe, normalizarConfig, pluginId, type Copia, type Fuentes, type Video } from '@/plugins/sably-video/src/modelo';

export type { Fuentes };

async function leer<T>(db: any, coleccion: string, id: string): Promise<T | undefined> {
  const fila = await db.selectFrom('_plugin_storage').select('data').where('plugin_id', '=', pluginId)
    .where('collection', '=', coleccion).where('id', '=', id).executeTakeFirst() as { data?: string } | undefined;
  return fila?.data ? (JSON.parse(fila.data) as T) : undefined;
}

export async function videoDeCurso(slug: string): Promise<Fuentes | undefined> {
  try {
    const { getDb } = await import('emdash/runtime');
    const db = await getDb();
    const uso = await leer<{ video: string }>(db, 'usos', `curso:${slug}`);
    if (!uso?.video) return undefined;
    const [video, mux, opcion] = await Promise.all([
      leer<Video>(db, 'videos', uso.video),
      leer<Copia>(db, 'copias', `${uso.video}:mux`),
      (db as any).selectFrom('options').select('value').where('name', '=', `plugin:${pluginId}:config`).executeTakeFirst() as Promise<{ value?: string } | undefined>,
    ]);
    if (!video) return undefined;
    const config = normalizarConfig(opcion?.value ? JSON.parse(opcion.value) : undefined);
    return fuentesDe(video, mux ? [mux] : [], config);
  } catch {
    return undefined;
  }
}
