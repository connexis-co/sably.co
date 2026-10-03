import { getContentRepository } from '@/lib/emdash-content';
import { pagePathAvailable } from '@/lib/page-path';
import type { PublicPageContext } from './types';
export async function loadCustomPage(Astro:PublicPageContext) {
 const cms=await getContentRepository();const countries=await cms.getCountries();
 if(!pagePathAvailable(Astro.url.pathname,countries.map(country=>country.code)))return null;
 const page=await cms.getPageByPath(Astro.url.pathname);if(!page)return null;
 const country=countries.find(country=>country.code==='co')??countries[0];if(!country)return null;
 Astro.locals.sablyContent=page.contentRef;Astro.locals.sablySeo=page.seo;
 return {page,country};
}
export const pageNotFound=()=>new Response('Página no encontrada',{status:404,headers:{'X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'}});
