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
  const name = params.name!.replace(/^sitemap-/, '');
  let urls;
  if (name === 'pages') urls = pagesUrls();
  else if (name === 'categorias') urls = categoriasUrls();
  else if (name === 'blog') urls = await blogUrls();
  else urls = await cursosUrls(name.replace('cursos-', ''));
  return new Response(renderUrlset(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
};
