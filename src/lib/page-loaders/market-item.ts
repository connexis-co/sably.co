import { getContentRepository, type CmsCity } from '@/lib/emdash-content';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {

const cms = await getContentRepository();

const country = await cms.getCountry(Astro.params.country ?? '');

if (!country) return new Response('Not found', {status:404});

const city = country.cities.find(c => c.slug === Astro.params.item) as CmsCity | undefined;

const content = city ? null : await cms.resolveCourseContent(Astro.params.item ?? '', country.code);

if (!city && !content) return new Response('Not found', {status:404});

const subject = city ?? content!.course;

Astro.locals.sablyContent = subject.contentRef;

Astro.locals.sablySeo = subject.seo;

Astro.response.headers.set('X-Sably-Content-Source', 'emdash');
return {cms,country,city,content,subject};
}
