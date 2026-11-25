import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
import { env } from 'virtual:sably-runtime';
import { cmsImageUrl } from '@/lib/cms-media';
import { cloudflareImageUrl } from '@/lib/cloudflare-images';
import { courseCover } from '@/lib/categories';
import { notaHotmart } from '@/lib/opiniones';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
import { SITE } from '@/lib/site';
export const prerender = false;


/** Índice liviano para el buscador del sitio (se carga lazy al abrir la búsqueda). */
const thumb = (src: string) => cloudflareImageUrl(src, 160, SITE.url) ?? src;

export const GET: APIRoute = async ({ locals }) => {
  const cms = await getContentRepository();
  const [courses, categories, ratings] = await Promise.all([
    cms.getCourses(), cms.getCategories(),
    readOperationalRatings((env as unknown as { SABLY_DB: D1Database }).SABLY_DB, locals).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>)),
  ]);
  const getCategory = (slug:string) => categories.find(c=>c.slug===slug)!;
  const index = courses.map((c) => ({
    t: c.data.title,
    s: c.id,
    c: getCategory(c.data.category).name,
    k: (c.data.keywords ?? []).join(' '),
    /* Para el buscador V2: área, miniatura de 160 px y nota de Hotmart (si llega al mínimo). El clásico los ignora. */
    a: c.data.category,
    i: thumb(cmsImageUrl(c.cardImage) ?? cmsImageUrl(c.coverImage) ?? courseCover(c.id, c.data.category, 'card')),
    n: notaHotmart(ratings[c.id] ?? null)?.cifra,
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
