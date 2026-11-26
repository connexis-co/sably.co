import { getContentRepository } from '@/lib/emdash-content';
import type { PublicPageContext } from './types';

/**
 * Las páginas de ciudad (hub, catálogo, categoría y ciudad×curso) repetían la de
 * país con el nombre de la ciudad: ~4.800 URLs al 94–97 % de similitud para un
 * producto 100 % online. Es el patrón de «doorway pages» de las políticas de spam
 * de Google; la canonical no lo retiraba porque las URLs seguían publicadas y
 * enlazadas. Ahora responden con un único 301 a su equivalente de país y conservan
 * la query (campañas y referencias de ChatGPT). Ver docs/SEO_DIAGNOSTICO_2026-10-12.md.
 */
export type CityRoute = 'catalog' | 'category' | 'course';

/**
 * Slugs de ciudad que nunca existieron pero reciben visitas, y la ciudad que quieren decir. Solo
 * `/mx/ciudad-de-mexico/` (la de CDMX siempre fue `cdmx`): 404 con 2 peticiones en 8 días
 * (docs/equipo/2026-11-25/seo/ciudades.md, propuesta E). Con el alias sigue el mismo 301 que las demás.
 */
const ALIAS_CIUDAD: Record<string, Record<string, string>> = { mx: { 'ciudad-de-mexico': 'cdmx' } };
export const slugDeCiudad = (pais: string, item: string | undefined): string | undefined =>
  (item && ALIAS_CIUDAD[pais]?.[item]) || item;

/**
 * El hub `/{país}/{ciudad}/` comparte ruta con las fichas de país y lo resuelve market-item.
 * Con `ciudad`, el destino lleva `#ciudad=<slug>`: los buscadores ignoran el fragmento (misma URL y misma canónica,
 * nada nuevo que indexar) y el navegador lo conserva, así que quien llega desde ChatGPT por «… en Medellín» tiene su
 * ciudad ya elegida en «País y moneda» (SelectorCiudad.astro la guarda y limpia el fragmento).
 */
export const cityRedirect = (Astro: Pick<PublicPageContext, 'url'>, path: string, ciudad?: string): Response =>
  new Response(null, { status: 301, headers: { Location: `${path}${Astro.url.search}${ciudad ? `#ciudad=${encodeURIComponent(ciudad)}` : ''}` } });

export async function load(Astro: PublicPageContext, route: CityRoute): Promise<Response> {
  const cms = await getContentRepository();
  const country = await cms.getCountry(Astro.params.country ?? '');
  const item = country ? slugDeCiudad(country.code, Astro.params.item) : undefined;
  const city = country?.cities.find(c => c.slug === item);
  if (!country || !city) return new Response('Not found', { status: 404 });
  const base = `/${country.code}`;
  if (route === 'catalog') return cityRedirect(Astro, `${base}/cursos/`, city.slug);
  if (route === 'category') {
    const category = await cms.getCategory(Astro.params.category ?? '');
    return category && !category.externalUrl
      ? cityRedirect(Astro, `${base}/cursos/${category.slug}/`, city.slug)
      : new Response('Not found', { status: 404 });
  }
  const content = await cms.resolveCourseContent(Astro.params.slug ?? '', country.code);
  return content ? cityRedirect(Astro, `${base}/${content.course.id}/`, city.slug) : new Response('Not found', { status: 404 });
}
