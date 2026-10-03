import {getContentRepository} from '../emdash-content';
import {courseWatch} from '../course-watch';
import {DEFAULT_COUNTRY} from '../countries';
import {SITE,CDN_URL} from '../site';
import type {PublicPageContext} from './types';
import {courseSeo,indexableAtPath} from '../cms-indexability';

export async function load(Astro:PublicPageContext) {
 const cms=await getContentRepository();
 const [country,countries,courses,locales]=await Promise.all([cms.getCountry(DEFAULT_COUNTRY),cms.getCountries(),cms.getCourses(),cms.getCourseLocales()]);
 const videos=courses.map(c=>courseWatch(c,SITE.url,CDN_URL)).filter(v=>v!==null);
 const video=videos.find(v=>v.course.id===Astro.params.slug);
 if(!country||!video)return new Response('Not found',{status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});
 const markets=countries.filter(c=>!c.seo?.noIndex&&indexableAtPath(courseSeo(video.course.seo,locales.find(l=>l.data.course===video.course.id&&l.data.country===c.code)?.seo),`/${c.code}/${video.course.id}/`,SITE.url));
 Astro.response.headers.set('X-Sably-Content-Source','emdash');
 return {country,video,markets,related:videos.filter(v=>v.course.id!==video.course.id&&v.course.data.category===video.course.data.category).slice(0,4)};
}
