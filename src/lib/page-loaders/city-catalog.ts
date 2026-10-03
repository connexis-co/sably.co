import { getContentRepository } from '@/lib/emdash-content';
import { breadcrumbSchema, itemListSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();

const country = await cms.getCountry(Astro.params.country!);

if (!country) return new Response('Not found', {status:404});

Astro.locals.sablyContent = country.contentRef;

Astro.locals.sablySeo = country.seo;

const CATEGORIES = await cms.getCategories();

const INTERNAL_CATEGORIES = CATEGORIES.filter(c => !c.externalUrl);

const city = country.cities.find(c => c.slug === Astro.params.item);

if (!city) return new Response('Not found', {status:404});

Astro.locals.sablyContent = (city as import('@/lib/emdash-content').CmsCity).contentRef;

const base = `/${country.code}`;

const raiz = `${base}/${city.slug}`;


const courses = await cms.getCourses();

const byCategory = INTERNAL_CATEGORIES.map((cat) => ({
  cat,
  courses: courses.filter((c) => c.data.category === cat.slug),
})).filter((g) => g.courses.length > 0);


const title = `Cursos Online en ${city.name} | ${courses.length}+ con Certificado | Sably`;

const description = `Catálogo completo de cursos online para estudiar desde ${city.name}: oficios, belleza, gastronomía y más. Certificado incluido.`;


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}${base}/` },
    { name: city.name, url: `${SITE.url}${raiz}/` },
    { name: 'Cursos', url: `${SITE.url}${raiz}/cursos/` },
  ]),
  // ItemList ayuda a que Google entienda la página como un listado y pueda
  // mostrar enlaces de sitio a las categorías.
  itemListSchema(
    byCategory.map((g) => ({
      name: g.cat.name,
      url: `${SITE.url}${raiz}/cursos/${g.cat.slug}/`,
    })),
  ),
];
return {cms,country,CATEGORIES,INTERNAL_CATEGORIES,city,base,raiz,courses,byCategory,title,description,schemas};
}
