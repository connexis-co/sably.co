import { getContentRepository } from '../emdash-content';
import { courseWatch } from '../course-watch';
import { DEFAULT_COUNTRY } from '../countries';
import { SITE, CDN_URL } from '../site';
import { breadcrumbSchema, itemListSchema } from '../seo';
import type { PublicPageContext } from './types';

export async function load(Astro: PublicPageContext) {
  const cms = await getContentRepository();
  const [country, courses] = await Promise.all([cms.getCountry(DEFAULT_COUNTRY), cms.getCourses()]);
  const videos = courses.map(course => courseWatch(course, SITE.url, CDN_URL)).filter(video => video !== null);
  if (!country || !videos.length) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
  Astro.response.headers.set('X-Sably-Content-Source', 'emdash');
  const title = 'Presentaciones de cursos en vídeo | Sably';
  const description = 'Mira las presentaciones de nuestros cursos online y conoce su enfoque antes de consultar el programa y las opciones de inscripción.';
  return { country, videos, title, description, schemas: [
    breadcrumbSchema([{ name: 'Inicio', url: `${SITE.url}/${country.code}/` }, { name: 'Vídeos', url: `${SITE.url}/videos/` }]),
    itemListSchema(videos.map(video => ({ name: video.title, url: video.url }))),
  ] };
}
