import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getCategory } from '@/lib/categories';

/** Índice liviano para el buscador del sitio (se carga lazy al abrir la búsqueda). */
export const GET: APIRoute = async () => {
  const courses = await getCollection('courses');
  const index = courses.map((c) => ({
    t: c.data.title,
    s: c.id,
    c: getCategory(c.data.category).name,
    k: (c.data.keywords ?? []).join(' '),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
};
