import { getContentRepository } from '@/lib/emdash-content';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {

const cms = await getContentRepository();

const country = await cms.getCountry(Astro.params.country ?? '');

const city = country?.cities.find(c => c.slug === Astro.params.item);

if (!country || !city) return new Response('Not found', {status:404});

const content = await cms.resolveCourseContent(Astro.params.slug ?? '', country.code);

if (!content) return new Response('Not found', {status:404});

Astro.locals.sablyContent = content.course.contentRef;

Astro.locals.sablySeo = content.course.seo;

Astro.response.headers.set('X-Sably-Content-Source', 'emdash');
return {cms,country,city,content};
}
