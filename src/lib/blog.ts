import { CATEGORIES, categoryCover } from './categories';

/** Imagen de portada para un post según su categoría editorial (fallback: emprendimiento). */
export function blogCover(category: string | undefined, variant: 'hero' | 'card' = 'card'): string {
  const normalized = (category ?? '').toLowerCase();
  const match = CATEGORIES.find(
    (c) => !c.externalUrl && (c.name.toLowerCase() === normalized || c.slug === normalized),
  );
  return categoryCover(match?.slug ?? 'emprendimiento', variant);
}

/** Estimación de lectura (~200 palabras/min). */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}

/** Encabezados H2/H3 del MDX renderizado, para la tabla de contenidos. */
export interface TocItem {
  depth: 2 | 3;
  text: string;
  slug: string;
}

/** Categorías editoriales presentes en el blog, con su conteo. */
export function blogFacets(posts: { data: { category?: string } }[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of posts) {
    const c = p.data.category ?? 'Guía';
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Tono de color de una categoría del blog (DISENO §4 y §5.1): solo marca la etiqueta y la portada tipográfica. */
export type TonoCategoria = 'noche' | 'coral' | 'ambar' | 'verde' | 'tinta';
const TONOS: [RegExp, TonoCategoria][] = [
  [/^(oficio|emprend)/, 'noche'],
  [/^(belleza|moda)/, 'coral'],
  [/^(gastronom|panader|cocina|reposter)/, 'ambar'],
  [/^(bienestar|cuidado animal|mascota|salud)/, 'verde'],
];
const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function tonoDeCategoria(categoria: string | undefined): TonoCategoria {
  const c = sinTildes(categoria ?? '');
  return TONOS.find(([re]) => re.test(c))?.[1] ?? 'tinta';
}

/** Slug estable de una categoría para `?categoria=` (sin tildes ni espacios). */
export const slugCategoria = (categoria: string | undefined) => sinTildes(categoria ?? 'guia').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Frase corta para la portada tipográfica: lo que va antes de «:» en el título, si cabe en 32 caracteres; si no, las primeras palabras. */
export function titularPortada(titulo: string): string {
  const antes = titulo.split(':')[0]!.trim();
  if (antes.length <= 32) return antes;
  let salida = '';
  for (const p of antes.split(/\s+/)) { if ((salida + ' ' + p).trim().length > 32) break; salida = (salida + ' ' + p).trim(); }
  return salida || antes.slice(0, 32);
}

/** Minutos de lectura del diseño V2: palabras / 220, hacia arriba, mínimo 1. */
export function minutosLectura(texto: string): number {
  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(palabras / 220));
}

/** Fecha corta en español: «9 sept. 2026» (sin año si `sinAno`), en hora de Colombia. */
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];
export function fechaCorta(fecha: Date, sinAno = false): string {
  const [a, m, d] = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).split('-').map(Number);
  return `${d} ${MESES[m! - 1]}${sinAno ? '' : ` ${a}`}`;
}

/** El oficio que enseña un curso, para «Aprende soldadura con un curso completo»: «Curso de soldadura: arco…» → «soldadura». */
export function oficioDeCurso(titulo: string): string | null {
  const m = titulo.match(/^curso(?:\s+online)?\s+(?:de|del|para)\s+(.+?)(?:\s*[:(,–—-].*)?$/i);
  if (!m) return null;
  const o = m[1]!.trim();
  return o.length > 40 ? null : o.charAt(0).toLowerCase() + o.slice(1);
}

/** Entrada del índice del artículo (los ids los pone rich-content). */
export interface Apartado { depth: number; slug: string; text: string }
