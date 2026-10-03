import {courseSeo,indexableAtPath} from './cms-indexability';
import { normalizePagePath, pagePathAvailable } from './page-path';
import { getContentRepository, type CmsMeta } from './emdash-content';
import { SITE, CDN_URL } from './site';
import { COURSE_VIDEOS } from './course-videos';
import { courseCover } from './categories';

export interface UrlEntry {
  loc: string;
  /** ISO 8601. Señal de frescura para el re-crawl (IndexNow/Bing/Google). Es
      la fecha real del último cambio del contenido: ver fechaDe(). */
  lastmod: string;
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


// Only real CMS timestamps are emitted. No build-time/git fallback can pretend
// a content update occurred when a Worker is redeployed.
const latest = (entries: Pick<CmsMeta,'updatedAt'>[]): string => entries.map(e=>e.updatedAt).sort().at(-1) ?? '';
const u = (path:string,lastmod:string):UrlEntry=>({loc:`${SITE.url}${path}`,lastmod});
const indexable = (entry:CmsMeta):boolean => !entry.seo?.noIndex;
const preferred = (entry:CmsMeta,path:string):boolean => indexableAtPath(entry.seo,path,SITE.url);
export async function sitemapNames():Promise<string[]> {
 const countries=await (await getContentRepository()).getCountries();
 return ['pages','categorias','blog',...countries.filter(indexable).map(c=>`cursos-${c.code}`)];
}
export async function pagesUrls():Promise<UrlEntry[]> {
 const cms=await getContentRepository();
 const [countries,courses,posts,pages,programs,creators]=await Promise.all([cms.getCountries(),cms.getCourses(),cms.getBlogPosts(),cms.getPages(),cms.getPrograms(),cms.getCreators()]);
 const urls:UrlEntry[]=[];
 for(const country of countries.filter(indexable)){
  const lastmod=latest([country,...courses]);
  for(const path of [`/${country.code}/`,`/${country.code}/cursos/`])if(preferred(country,path))urls.push(u(path,lastmod));
  for(const creator of creators.filter(c=>c.cursos.length>0&&preferred(c,`/${country.code}/creadores/${c.slug}/`))) urls.push(u(`/${country.code}/creadores/${creator.slug}/`,latest([creator,...courses.filter(c=>creator.cursos.includes(c.id))])));
 }
 for(const page of pages.filter(page=>pagePathAvailable(page.path,countries.map(country=>country.code)))) {
  const path=normalizePagePath(page.path)!;
  if(preferred(page,path))urls.push(u(path,page.updatedAt));
 }
 for(const program of programs.filter(p=>preferred(p,`/homologaciones/${p.slug}/`))) urls.push(u(`/homologaciones/${program.slug}/`,program.updatedAt));
 if(programs.length) urls.push(u('/homologaciones/',latest(programs)));
 urls.push(u('/sitemap/',latest([...countries,...courses,...posts,...pages,...programs])));
 return urls;
}
export async function categoriasUrls():Promise<UrlEntry[]> {
 const cms=await getContentRepository();const [countries,categories,courses]=await Promise.all([cms.getCountries(),cms.getCategories(),cms.getCourses()]);
 return categories.filter(c=>!c.externalUrl&&indexable(c)).flatMap(category=>countries.filter(indexable).filter(country=>preferred(category,`/${country.code}/cursos/${category.slug}/`)).map(country=>u(`/${country.code}/cursos/${category.slug}/`,latest([category,...courses.filter(c=>c.data.category===category.slug)]))));
}
export async function cursosUrls(countryCode:string):Promise<UrlEntry[]> {
 const cms=await getContentRepository();const [country,courses,locales]=await Promise.all([cms.getCountry(countryCode),cms.getCourses(),cms.getCourseLocales()]);
 if(!country || !indexable(country)) return [];
 return courses.filter(c=>!/PENDIENTE/i.test(c.data.hotmartUrl)).flatMap(course=>{
  const variant=locales.find(l=>l.data.course===course.id&&l.data.country===countryCode);
  const path=`/${countryCode}/${course.id}/`;
  if(!indexableAtPath(courseSeo(course.seo,variant?.seo),path,SITE.url))return [];
  const entry=u(path,latest([course,...(variant?[variant]:[])]));
  const video=COURSE_VIDEOS[course.id];
  if(video && course.data.videoKey===video.key) entry.video={titulo:`${course.data.title} — presentación en vídeo`,descripcion:course.data.shortDescription,miniatura:new URL(courseCover(course.id,course.data.category),SITE.url).href,contenido:`${CDN_URL}/videos/${video.key}`,duracion:video.segundos,publicado:video.subido};
  return [entry];
 });
}
export async function blogUrls():Promise<UrlEntry[]> {
 const posts=(await (await getContentRepository()).getBlogPosts()).filter(post=>preferred(post,`/blog/${post.id}/`));
 return [...(posts.length?[u('/blog/',latest(posts))]:[]),...posts.map(post=>u(`/blog/${post.id}/`,post.updatedAt))];
}
// This legacy discovery endpoint remains available, excluded from the index;
// it mirrors existing Googlebot noindex + country canonical city policy.
export const SITEMAPS_TEMPORALES=['temporal-ciudades-noindex'];
export async function ciudadesNoindexUrls():Promise<UrlEntry[]> {
 const cms=await getContentRepository();const [countries,categories]=await Promise.all([cms.getCountries(),cms.getCategories()]);
 return countries.flatMap(country=>country.cities.flatMap(city=>{
  const root=`/${country.code}/${city.slug}`;return [u(`${root}/`,country.updatedAt),u(`${root}/cursos/`,country.updatedAt),...categories.filter(c=>!c.externalUrl).map(c=>u(`${root}/cursos/${c.slug}/`,latest([country,c])))];
 }));
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
      return `<url><loc>${xml(x.loc)}</loc>${x.lastmod ? `<lastmod>${xml(x.lastmod)}</lastmod>` : ''}${v}</url>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${body}</urlset>`
  );
}
