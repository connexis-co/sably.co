import { getCollection } from 'astro:content';
import { COUNTRIES } from './countries';
import { INTERNAL_CATEGORIES } from './categories';
import { PROGRAMAS } from './homologaciones';
import { SITE, CDN_URL } from './site';
import { COURSE_VIDEOS, duracionIso } from './course-videos';
import { courseCover } from './categories';

/**
 * Sitemaps segmentados (docs/ARQUITECTURA_URLS.md §4.5): un archivo por país
 * para los cursos + pages/categorias/blog. Las prioridades orientan el crawl
 * budget de un dominio joven.
 */
export interface UrlEntry {
  loc: string;
  priority: number;
  changefreq: 'weekly' | 'monthly';
  /** Extensión de vídeo. Solo en las páginas donde el vídeo se reproduce. */
  video?: VideoEntry;
}

export interface VideoEntry {
  titulo: string;
  descripcion: string;
  /** Absoluta. */
  miniatura: string;
  /** Absoluta, al MP4. */
  contenido: string;
  /** Segundos. Google la rechaza si pasa de 8 horas. */
  duracion: number;
  /** ISO 8601. */
  publicado: string;
}

/** El texto del curso va dentro del XML: sin escapar, un `&` rompe el sitemap. */
const xml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const u = (path: string, priority: number, changefreq: 'weekly' | 'monthly' = 'weekly'): UrlEntry => ({
  loc: `${SITE.url}${path}`,
  priority,
  changefreq,
});

export function pagesUrls(): UrlEntry[] {
  const urls: UrlEntry[] = [];
  for (const c of COUNTRIES) {
    urls.push(u(`/${c.code}/`, 1.0));
    urls.push(u(`/${c.code}/cursos/`, 1.0));
    for (const city of c.cities) {
      urls.push(u(`/${c.code}/${city.slug}/`, 0.7, 'monthly'));
      urls.push(u(`/${c.code}/${city.slug}/cursos/`, 0.7, 'monthly'));
    }
  }
  urls.push(u('/nosotros/', 0.5, 'monthly'));
  urls.push(u('/homologaciones/', 0.8));
  for (const p of PROGRAMAS) urls.push(u(`/homologaciones/${p.slug}/`, 0.8));
  urls.push(u('/legal/terminos/', 0.3, 'monthly'));
  urls.push(u('/legal/privacidad/', 0.3, 'monthly'));
  urls.push(u('/sitemap/', 0.3, 'monthly'));
  return urls;
}

export function categoriasUrls(): UrlEntry[] {
  const urls: UrlEntry[] = [];
  for (const c of COUNTRIES) {
    for (const cat of INTERNAL_CATEGORIES) {
      urls.push(u(`/${c.code}/cursos/${cat.slug}/`, 0.8));
      for (const city of c.cities) {
        urls.push(u(`/${c.code}/${city.slug}/cursos/${cat.slug}/`, 0.6, 'monthly'));
      }
    }
  }
  return urls;
}

export async function cursosUrls(countryCode: string): Promise<UrlEntry[]> {
  const courses = await getCollection('courses');
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return [];
  const urls: UrlEntry[] = [];
  for (const course of courses) {
    const entrada = u(`/${country.code}/${course.id}/`, 0.9);
    const video = COURSE_VIDEOS[course.id];
    if (video) {
      // El vídeo se declara SOLO en la página de país, no en las 37 de ciudad:
      // el mismo archivo repetido en 45 URLs hace que Google elija una y
      // descarte el resto, y la que interesa es esta.
      entrada.video = {
        titulo: `${course.data.title} — presentación en vídeo`,
        descripcion: course.data.shortDescription,
        miniatura: new URL(courseCover(course.id, course.data.category), SITE.url).href,
        contenido: `${CDN_URL}/videos/${video.key}`,
        duracion: video.segundos,
        publicado: video.subido,
      };
    }
    urls.push(entrada);
    for (const city of country.cities) {
      urls.push(u(`/${country.code}/${city.slug}/${course.id}/`, 0.5, 'monthly'));
    }
  }
  return urls;
}

export async function blogUrls(): Promise<UrlEntry[]> {
  const posts = await getCollection('blog');
  return [u('/blog/', 0.7), ...posts.map((p) => u(`/blog/${p.id}/`, 0.6, 'monthly'))];
}

export function renderUrlset(urls: UrlEntry[]): string {
  const body = urls
    .map((x) => {
      const v = x.video
        ? `<video:video>` +
          `<video:thumbnail_loc>${xml(x.video.miniatura)}</video:thumbnail_loc>` +
          `<video:title>${xml(x.video.titulo)}</video:title>` +
          `<video:description>${xml(x.video.descripcion)}</video:description>` +
          `<video:content_loc>${xml(x.video.contenido)}</video:content_loc>` +
          `<video:duration>${x.video.duracion}</video:duration>` +
          `<video:publication_date>${x.video.publicado}</video:publication_date>` +
          `<video:family_friendly>yes</video:family_friendly>` +
          `<video:requires_subscription>no</video:requires_subscription>` +
          `</video:video>`
        : '';
      return `<url><loc>${x.loc}</loc><changefreq>${x.changefreq}</changefreq><priority>${x.priority.toFixed(1)}</priority>${v}</url>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${body}</urlset>`
  );
}

export const SITEMAP_NAMES = [
  'pages',
  'categorias',
  'blog',
  ...COUNTRIES.map((c) => `cursos-${c.code}`),
];
