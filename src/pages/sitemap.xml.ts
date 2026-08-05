import type { APIRoute } from 'astro';
import { SITE } from '@/lib/site';
import { SITEMAP_NAMES } from '@/lib/sitemap';

/** Alias /sitemap.xml → mismo índice (varias herramientas lo buscan en esta ruta). */
export const GET: APIRoute = () => {
  const body = SITEMAP_NAMES.map(
    (name) => `<sitemap><loc>${SITE.url}/sitemaps/sitemap-${name}.xml</loc></sitemap>`,
  ).join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
};
