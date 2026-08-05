import type { APIRoute } from 'astro';
import {
  SITEMAP_NAMES,
  blogUrls,
  categoriasUrls,
  cursosUrls,
  pagesUrls,
  renderUrlset,
} from '@/lib/sitemap';

export function getStaticPaths() {
  return SITEMAP_NAMES.map((name) => ({ params: { name: `sitemap-${name}` } }));
}

export const GET: APIRoute = async ({ params }) => {
  const raw = params.name ?? '';
  const name = raw.replace(/^sitemap-/, '');
  /* Un nombre no reconocido debe ser 404, no un urlset vacío. */
  if (!name || !SITEMAP_NAMES.includes(name)) {
    return new Response('Not found', { status: 404 });
  }

  let urls;
  if (name === 'pages') urls = pagesUrls();
  else if (name === 'categorias') urls = categoriasUrls();
  else if (name === 'blog') urls = await blogUrls();
  else urls = await cursosUrls(name.replace('cursos-', ''));

  return new Response(renderUrlset(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
};
