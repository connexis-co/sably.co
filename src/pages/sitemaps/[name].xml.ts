import type { APIRoute } from 'astro';
import {
  SITEMAP_NAMES,
  SITEMAPS_TEMPORALES,
  blogUrls,
  categoriasUrls,
  ciudadesNoindexUrls,
  cursosUrls,
  pagesUrls,
  renderUrlset,
} from '@/lib/sitemap';

/* Los temporales se generan aquí pero no entran en los índices (ver sitemap.ts). */
const NOMBRES = [...SITEMAP_NAMES, ...SITEMAPS_TEMPORALES];

export function getStaticPaths() {
  return NOMBRES.map((name) => ({ params: { name: `sitemap-${name}` } }));
}

export const GET: APIRoute = async ({ params }) => {
  const raw = params.name ?? '';
  const name = raw.replace(/^sitemap-/, '');
  /* Un nombre no reconocido debe ser 404, no un urlset vacío. */
  if (!name || !NOMBRES.includes(name)) {
    return new Response('Not found', { status: 404 });
  }

  let urls;
  if (name === 'pages') urls = pagesUrls();
  else if (name === 'categorias') urls = categoriasUrls();
  else if (name === 'blog') urls = await blogUrls();
  else if (name === 'temporal-ciudades-noindex') urls = ciudadesNoindexUrls();
  else urls = await cursosUrls(name.replace('cursos-', ''));

  return new Response(renderUrlset(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
};
