import {courseSeo} from '../cms-indexability';
import { getContentRepository } from '@/lib/emdash-content';
import { cityRedirect } from './city-redirect';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {

const cms = await getContentRepository();

const country = await cms.getCountry(Astro.params.country ?? '');

if (!country) return new Response('Not found', {status:404});

// Hub de ciudad: consolidado en la portada del país (ver city-redirect).
if (country.cities.some(c => c.slug === Astro.params.item)) return cityRedirect(Astro, `/${country.code}/`);

const content = await cms.resolveCourseContent(Astro.params.item ?? '', country.code);

if (!content) return new Response('Not found', {status:404});

Astro.locals.sablyContent = content.course.contentRef;

Astro.locals.sablySeo = courseSeo(content.course.seo,content.locale?.seo);

Astro.response.headers.set('X-Sably-Content-Source', 'emdash');
return {cms,country,content};
}
