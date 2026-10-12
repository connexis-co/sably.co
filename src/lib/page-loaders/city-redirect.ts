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

/** El hub `/{país}/{ciudad}/` comparte ruta con las fichas de país y lo resuelve market-item. */
export const cityRedirect = (Astro: Pick<PublicPageContext, 'url'>, path: string): Response =>
  new Response(null, { status: 301, headers: { Location: `${path}${Astro.url.search}` } });

export async function load(Astro: PublicPageContext, route: CityRoute): Promise<Response> {
  const cms = await getContentRepository();
  const country = await cms.getCountry(Astro.params.country ?? '');
  const city = country?.cities.find(c => c.slug === Astro.params.item);
  if (!country || !city) return new Response('Not found', { status: 404 });
  const base = `/${country.code}`;
  if (route === 'catalog') return cityRedirect(Astro, `${base}/cursos/`);
  if (route === 'category') {
    const category = await cms.getCategory(Astro.params.category ?? '');
    return category && !category.externalUrl
      ? cityRedirect(Astro, `${base}/cursos/${category.slug}/`)
      : new Response('Not found', { status: 404 });
  }
  const content = await cms.resolveCourseContent(Astro.params.slug ?? '', country.code);
  return content ? cityRedirect(Astro, `${base}/${content.course.id}/`) : new Response('Not found', { status: 404 });
}
