export const prerender = false;
import type { APIRoute } from 'astro';
import {
  sitemapNames,
  SITEMAPS_TEMPORALES,
  blogUrls,
  categoriasUrls,
  ciudadesNoindexUrls,
  cursosUrls,
  pagesUrls,
  videosUrls,
  renderUrlset,
} from '@/lib/sitemap';

export const GET: APIRoute = async ({ params }) => {
  const NOMBRES = [...await sitemapNames(), ...SITEMAPS_TEMPORALES];
  const raw = params.name ?? '';
  const name = raw.replace(/^sitemap-/, '');
  /* Un nombre no reconocido debe ser 404, no un urlset vacío. */
  if (!name || !NOMBRES.includes(name)) {
    return new Response('Not found', { status: 404 });
  }

  let urls;
  if (name === 'pages') urls = await pagesUrls();
  else if (name === 'categorias') urls = await categoriasUrls();
  else if (name === 'blog') urls = await blogUrls();
  else if (name === 'videos') urls = await videosUrls();
  else if (name === 'temporal-ciudades-noindex') urls = await ciudadesNoindexUrls();
  else urls = await cursosUrls(name.replace('cursos-', ''));

  return new Response(renderUrlset(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
};
