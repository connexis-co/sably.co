/**
 * Vídeos que ya están en R2 (25-nov-2026, ver docs/equipo/2026-11-25/video/INVENTARIO.md), para darlos de alta en la
 * biblioteca desde el panel («Cargar los vídeos de R2»). Los 15 de presentación salen de COURSE_VIDEOS; los demás son
 * vídeos oficiales que el creador enlaza en su ficha de Hotmart. Duraciones medidas con ffprobe sobre el original.
 */
import { COURSE_VIDEOS } from '@/lib/course-videos';
import type { Video } from './modelo';

const EXTRA: Record<string, Omit<Video, 'creado'>> = {
  'curso-de-pollo-broaster': { titulo: 'Curso de pollo broaster', original: 'videos/originales/curso-de-pollo-broaster.mp4', segundos: 46.74, ancho: 1920, alto: 1080, origen: 'https://www.youtube.com/watch?v=OvnA14qD-Fk' },
  'curso-de-drenaje-linfatico': { titulo: 'Curso de drenaje linfático', original: 'videos/originales/curso-de-drenaje-linfatico.mp4', segundos: 81.78, ancho: 3840, alto: 2160, origen: 'https://www.youtube.com/watch?v=czKWuCJJ5QM' },
  'curso-de-barista': { titulo: 'Curso de barista', original: 'videos/originales/curso-de-barista.mp4', segundos: 78.46, ancho: 1920, alto: 1080, origen: 'https://www.youtube.com/watch?v=i_xmd0KUcCc' },
};

/** Clave web en R2: la de COURSE_VIDEOS si existe (`web/…` con caché larga, o `hd/…` en ramas sin ese cambio). */
export function semilla(ahora = Date.now()): Record<string, Video> {
  const salida: Record<string, Video> = {};
  for (const [slug, v] of Object.entries(COURSE_VIDEOS)) {
    salida[slug] = {
      titulo: slug.replace(/^curso-de-/, 'Curso de ').replaceAll('-', ' '),
      original: `videos/originales/${slug}.mp4`, web: `videos/${v.key}`, segundos: v.segundos, ancho: 1920, alto: 1080,
      origen: 'YouTube · Sably Academy', creado: ahora,
    };
  }
  for (const [slug, v] of Object.entries(EXTRA)) salida[slug] = { ...v, creado: ahora };
  return salida;
}
