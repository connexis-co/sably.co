/**
 * Índice del buscador del blog (portada.ts lo pide al primer foco del campo): guías, categorías y cursos con el
 * precio de hoy en Colombia (el mismo de la ficha: `preciosDeTarjetas`, solo memoria y sably.db). ~10 KB comprimido.
 */
import type { APIRoute } from 'astro';
import { getContentRepository } from '@/lib/emdash-content';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { blogFacets, slugCategoria } from '@/lib/blog';
import { indexableAtPath } from '@/lib/cms-indexability';
import { preciosDeTarjetas } from '@/lib/precio-hoy';
import { importe } from '@/lib/presentacion-v2';
import { SITE } from '@/lib/site';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const cms = await getContentRepository();
  const [posts, cursos, country] = await Promise.all([cms.getBlogPosts(), cms.getCourses(), cms.getCountry(DEFAULT_COUNTRY)]);
  const guias = posts.filter(p => indexableAtPath(p.seo, `/blog/${p.id}/`, SITE.url))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
  const { precios } = country ? await preciosDeTarjetas(cursos, country, { url, locals }) : { precios: new Map() };
  const cuerpo = {
    articulos: guias.map(p => ({ t: p.data.title, u: `/blog/${p.id}/`, c: p.data.category ?? 'Guía', k: (p.data.keywords ?? []).join(' ') })),
    categorias: blogFacets(guias).map(f => ({ n: f.name, u: `/blog/?categoria=${slugCategoria(f.name)}`, k: f.count })),
    cursos: country ? cursos.map(c => {
      const p = precios.get(c.id);
      const i = p ? importe(p.hoy, p.moneda, country.hreflang) : null;
      return { t: c.data.title, u: `/${country.code}/${c.id}/`, p: i ? `${i.visible} ${i.codigo}` : '' };
    }) : [],
  };
  return new Response(JSON.stringify(cuerpo), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600', 'X-Robots-Tag': 'noindex' },
  });
};
