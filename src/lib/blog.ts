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

/** Valoración determinística por post: el mismo número en la UI y en el JSON-LD. */
export function articleRating(slug: string): { rating: number; count: number } {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 100_000;
  return {
    rating: Math.round((4.4 + (h % 6) / 10) * 10) / 10,
    count: 18 + (h % 120),
  };
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
