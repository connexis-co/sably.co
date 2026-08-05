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
