import relleno from '@/data/instructores-relleno.json';
import { cmsImageUrl } from './cms-media';
import { fotoPropia } from './presentacion-v2';

/**
 * Docente REAL de un curso (punto C5 del encargo de pulido).
 *
 * El campo `instructor` del curso guardó durante meses nombres inventados. Por
 * eso aquí no basta con que haya un nombre: un docente solo se pinta si trae
 * la URL de la fuente que lo nombra como quien imparte el curso
 * (`source_url`, https) y la fecha en que se leyó (`read_at`). Los inventados
 * nunca tuvieron fuente, así que aunque quede alguno sin vaciar en el CMS no
 * sale en la página. Además se descartan los nombres del lote de relleno.
 *
 * Datos y método: docs/equipo/2026-11-25/docentes/DOCENTES.md (fuera del repo).
 */
/** «Imparte» o «Imparten»: hay cursos que dan dos personas («Wilmer Torres y Olga Amaya»). */
export const verboImparte = (nombre: string) => (/\s(y|e)\s/i.test(nombre) ? 'Imparten' : 'Imparte');

export interface Docente {
  slug: string;
  nombre: string;
  /** Oficio o título corto, tal como lo presenta la fuente. */
  titulo: string;
  /** Trayectoria resumida de la fuente, sin añadir hechos. */
  trayectoria: string;
  acreditaciones: string;
  /** Solo fotos servidas por sably.co (mediateca de EmDash); si no, iniciales. */
  foto: string | null;
  fuente: string;
}

const NOMBRES_RELLENO = new Set(relleno.nombres.map((n) => n.nombre.toLowerCase()));

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function urlSegura(v: unknown): string | null {
  const s = texto(v);
  try { return new URL(s).protocol === 'https:' ? s : null; } catch { return null; }
}

/** `course.data.instructor` (JSON del CMS) → docente con fuente, o `null`. */
export function docenteReal(valor: unknown): Docente | null {
  if (!valor || typeof valor !== 'object') return null;
  const d = valor as Record<string, unknown>;
  const nombre = texto(d.name);
  const fuente = urlSegura(d.source_url);
  if (!nombre || !fuente || !/^\d{4}-\d{2}-\d{2}/.test(texto(d.read_at))) return null;
  if (NOMBRES_RELLENO.has(nombre.toLowerCase())) return null;
  const foto = cmsImageUrl(d.photo);
  return {
    slug: texto(d.slug) || nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    nombre,
    titulo: texto(d.title),
    trayectoria: texto(d.bio),
    acreditaciones: texto(d.credentials),
    foto: fotoPropia(foto) ? foto : null,
    fuente,
  };
}
