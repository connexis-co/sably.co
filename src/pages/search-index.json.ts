import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
export const prerender = false;


/** Índice liviano para el buscador del sitio (se carga lazy al abrir la búsqueda). */
export const GET: APIRoute = async () => {
  const cms = await getContentRepository();
  const [courses, categories, COUNTRIES] = await Promise.all([cms.getCourses(), cms.getCategories(), cms.getCountries()]);
  const INTERNAL_CATEGORIES = categories.filter(c => !c.externalUrl);
  const getCategory = (slug:string) => categories.find(c=>c.slug===slug)!;
  const index = courses.map((c) => ({
    t: c.data.title,
    s: c.id,
    c: getCategory(c.data.category).name,
    k: (c.data.keywords ?? []).join(' '),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
