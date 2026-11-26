import { getContentRepository } from '@/lib/emdash-content';
import { countryAlternates, breadcrumbSchema, conMarca, itemListSchema } from '@/lib/seo';
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

const base = `/${country.code}`;

const courses = await cms.getCourses();
const creators = (await cms.getCreators()).filter(creator => creator.cursos.length > 0);


const byCategory = INTERNAL_CATEGORIES.map((cat) => ({
  cat,
  courses: courses.filter((c) => c.data.category === cat.slug),
})).filter((g) => g.courses.length > 0);


/* Sin cifra y sin «catálogo»: el título decía «Catálogo de 120+ cursos» cuando
   se pueden comprar 112, y Sably no se presenta como catálogo. La marca entra
   en los 8 países (≤60, ver conMarca). */
const title = conMarca(`Todos los cursos online en ${country.name}`);

const description = `Explora todos los cursos online de Sably disponibles en ${country.name}: oficios, gastronomía, moda, emprendimiento y más. Con certificado de finalización.`;


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}${base}/` },
    { name: 'Cursos', url: `${SITE.url}${base}/cursos/` },
  ]),
  // Marca la página como listado: habilita los enlaces de sitio bajo el
  // resultado en vez de un único enlace azul.
  itemListSchema(
    byCategory.map((g) => ({ name: g.cat.name, url: `${SITE.url}${base}/cursos/${g.cat.slug}/` })),
  ),
];
return {cms,country,CATEGORIES,INTERNAL_CATEGORIES,base,courses,creators,byCategory,title,description,schemas};
}
