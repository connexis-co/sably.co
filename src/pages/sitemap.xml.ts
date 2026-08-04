import type { APIRoute } from 'astro';
import { COURSES } from '../data/courses';
import { SITE } from '../data/site';

const staticPages = [
  '/',
  '/cursos',
  '/black-university',
  '/nosotros',
  '/contacto',
  '/legal/terminos',
  '/legal/privacidad',
  '/legal/reembolsos',
  '/legal/cookies',
];

export const GET: APIRoute = () => {
  const urls = [
    ...staticPages,
    ...COURSES.map((c) => `/cursos/${c.slug}`),
  ]
    .map(
      (path) =>
        `  <url><loc>${new URL(path, SITE.url).href}</loc><changefreq>weekly</changefreq></url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
