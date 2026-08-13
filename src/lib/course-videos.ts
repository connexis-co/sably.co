/**
 * Duración y fecha de subida de los vídeos de presentación.
 *
 * Generado por scripts/build-video-manifest.mjs a partir de los MP4 reales del
 * CDN: la duración con ffprobe y la fecha del Last-Modified de R2. Ninguno de
 * los dos está en el frontmatter, y son los que Google necesita para el
 * VideoObject —la duración es la que pinta la insignia de tiempo en el
 * resultado—, así que no valen aproximaciones.
 *
 * Se commitea porque el build no puede sondear la red por cada página y en CI
 * no hay ffprobe. Al añadir o reemplazar un vídeo, volver a ejecutar el script.
 */
export interface VideoCurso {
  /** Ruta dentro del bucket, la misma del frontmatter `videoKey`. */
  key: string;
  /** Duración en segundos, medida sobre el archivo. */
  segundos: number;
  /** ISO 8601. Cuándo se subió a R2. */
  subido: string;
}

export const COURSE_VIDEOS: Record<string, VideoCurso> = {
  'curso-de-automaquillaje': { key: 'hd/curso-de-automaquillaje.mp4', segundos: 41, subido: '2026-08-13T08:37:24.000Z' },
  'curso-de-barberia': { key: 'hd/curso-de-barberia.mp4', segundos: 25, subido: '2026-08-13T08:37:26.000Z' },
  'curso-de-cejas-y-pestanas': { key: 'hd/curso-de-cejas-y-pestanas.mp4', segundos: 43, subido: '2026-08-13T08:37:28.000Z' },
  'curso-de-decoracion-de-unas': { key: 'hd/curso-de-decoracion-de-unas.mp4', segundos: 36, subido: '2026-08-13T08:37:30.000Z' },
  'curso-de-depilacion': { key: 'hd/curso-de-depilacion.mp4', segundos: 26, subido: '2026-08-13T08:37:32.000Z' },
  'curso-de-extensiones-de-pestanas': { key: 'hd/curso-de-extensiones-de-pestanas.mp4', segundos: 27, subido: '2026-08-13T08:37:35.000Z' },
  'curso-de-limpieza-facial': { key: 'hd/curso-de-limpieza-facial.mp4', segundos: 24, subido: '2026-08-13T08:37:37.000Z' },
  'curso-de-manicure-y-pedicure': { key: 'hd/curso-de-manicure-y-pedicure.mp4', segundos: 27, subido: '2026-08-13T08:37:39.000Z' },
  'curso-de-maquillaje': { key: 'hd/curso-de-maquillaje.mp4', segundos: 41, subido: '2026-08-13T08:37:42.000Z' },
  'curso-de-masaje-reductor': { key: 'hd/curso-de-masaje-reductor.mp4', segundos: 42, subido: '2026-08-13T08:37:44.000Z' },
  'curso-de-masajes': { key: 'hd/curso-de-masajes.mp4', segundos: 25, subido: '2026-08-13T08:37:48.000Z' },
  'curso-de-masajes-terapeuticos-y-relajantes': { key: 'hd/curso-de-masajes-terapeuticos-y-relajantes.mp4', segundos: 42, subido: '2026-08-13T08:37:46.000Z' },
  'curso-de-peinados': { key: 'hd/curso-de-peinados.mp4', segundos: 24, subido: '2026-08-13T08:37:50.000Z' },
  'curso-de-trenzas-y-peinados': { key: 'hd/curso-de-trenzas-y-peinados.mp4', segundos: 30, subido: '2026-08-13T08:37:52.000Z' },
  'curso-de-unas-acrilicas': { key: 'hd/curso-de-unas-acrilicas.mp4', segundos: 37, subido: '2026-08-13T08:37:54.000Z' },
};

/** Duración en formato ISO 8601, que es el que exige Schema.org: PT1M23S. */
export function duracionIso(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `PT${m ? `${m}M` : ''}${s}S`;
}
