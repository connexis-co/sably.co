/**
 * Duración y fecha de subida de los vídeos de presentación.
 *
 * Generado por scripts/build-video-manifest.mjs a partir de los MP4 reales del
 * CDN (la copia de `videos/web/`, ver scripts/video-r2.mjs): la duración con ffprobe y la fecha del Last-Modified de R2. Ninguno de
 * los dos está en el frontmatter, y son los que Google necesita para el
 * VideoObject —la duración es la que pinta la insignia de tiempo en el
 * resultado—, así que no valen aproximaciones.
 *
 * Se commitea porque el build no puede sondear la red por cada página y en CI
 * no hay ffprobe. Al añadir o reemplazar un vídeo, volver a ejecutar el script.
 */
export interface VideoCurso {
  /** Ruta servida dentro de `videos/` en el bucket: copia web 720p sin la cortinilla final, con caché inmutable de un año. */
  key: string;
  /** La que guarda el CMS en `videoKey` (copia antigua con caché de 4 h). Se acepta igual. */
  cms: string;
  /** Duración en segundos, medida sobre el archivo. */
  segundos: number;
  /** ISO 8601. Cuándo se subió a R2. */
  subido: string;
}

export const COURSE_VIDEOS: Record<string, VideoCurso> = {
  'curso-de-automaquillaje': { key: 'web2/curso-de-automaquillaje.mp4', cms: 'hd/curso-de-automaquillaje.mp4', segundos: 39, subido: '2026-08-13T08:37:24.000Z' },
  'curso-de-barberia': { key: 'web2/curso-de-barberia.mp4', cms: 'hd/curso-de-barberia.mp4', segundos: 23, subido: '2026-08-13T08:37:26.000Z' },
  'curso-de-cejas-y-pestanas': { key: 'web2/curso-de-cejas-y-pestanas.mp4', cms: 'hd/curso-de-cejas-y-pestanas.mp4', segundos: 41, subido: '2026-08-13T08:37:28.000Z' },
  'curso-de-decoracion-de-unas': { key: 'web2/curso-de-decoracion-de-unas.mp4', cms: 'hd/curso-de-decoracion-de-unas.mp4', segundos: 34, subido: '2026-08-13T08:37:30.000Z' },
  'curso-de-depilacion': { key: 'web2/curso-de-depilacion.mp4', cms: 'hd/curso-de-depilacion.mp4', segundos: 24, subido: '2026-08-13T08:37:32.000Z' },
  'curso-de-extensiones-de-pestanas': { key: 'web2/curso-de-extensiones-de-pestanas.mp4', cms: 'hd/curso-de-extensiones-de-pestanas.mp4', segundos: 25, subido: '2026-08-13T08:37:35.000Z' },
  'curso-de-limpieza-facial': { key: 'web2/curso-de-limpieza-facial.mp4', cms: 'hd/curso-de-limpieza-facial.mp4', segundos: 22, subido: '2026-08-13T08:37:37.000Z' },
  'curso-de-manicure-y-pedicure': { key: 'web2/curso-de-manicure-y-pedicure.mp4', cms: 'hd/curso-de-manicure-y-pedicure.mp4', segundos: 25, subido: '2026-08-13T08:37:39.000Z' },
  'curso-de-maquillaje': { key: 'web2/curso-de-maquillaje.mp4', cms: 'hd/curso-de-maquillaje.mp4', segundos: 39, subido: '2026-08-13T08:37:42.000Z' },
  'curso-de-masaje-reductor': { key: 'web2/curso-de-masaje-reductor.mp4', cms: 'hd/curso-de-masaje-reductor.mp4', segundos: 40, subido: '2026-08-13T08:37:44.000Z' },
  'curso-de-masajes': { key: 'web2/curso-de-masajes.mp4', cms: 'hd/curso-de-masajes.mp4', segundos: 22, subido: '2026-08-13T08:37:48.000Z' },
  'curso-de-masajes-terapeuticos-y-relajantes': { key: 'web2/curso-de-masajes-terapeuticos-y-relajantes.mp4', cms: 'hd/curso-de-masajes-terapeuticos-y-relajantes.mp4', segundos: 40, subido: '2026-08-13T08:37:46.000Z' },
  'curso-de-peinados': { key: 'web2/curso-de-peinados.mp4', cms: 'hd/curso-de-peinados.mp4', segundos: 24, subido: '2026-08-13T08:37:50.000Z' },
  'curso-de-trenzas-y-peinados': { key: 'web2/curso-de-trenzas-y-peinados.mp4', cms: 'hd/curso-de-trenzas-y-peinados.mp4', segundos: 28, subido: '2026-08-13T08:37:52.000Z' },
  'curso-de-unas-acrilicas': { key: 'web2/curso-de-unas-acrilicas.mp4', cms: 'hd/curso-de-unas-acrilicas.mp4', segundos: 35, subido: '2026-08-13T08:37:54.000Z' },
};

/** Duración en formato ISO 8601, que es el que exige Schema.org: PT1M23S. */
export function duracionIso(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `PT${m ? `${m}M` : ''}${s}S`;
}

/**
 * Ruta que se sirve para el vídeo de un curso. Si el CMS guarda la clave antigua (`hd/…`) o la
 * nueva (`web/…`) del mismo vídeo, se sirve la nueva; así el despliegue no depende de editar
 * `videoKey` en el CMS a la vez. Cualquier otra clave pasa tal cual.
 */
export function videoServido(slug: string, videoKey: string | undefined | null): string | null {
  if (!videoKey) return null;
  const video = COURSE_VIDEOS[slug];
  return video && (videoKey === video.key || videoKey === video.cms) ? video.key : videoKey;
}
