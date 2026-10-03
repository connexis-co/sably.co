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


const byCategory = INTERNAL_CATEGORIES.map((cat) => ({
  cat,
  courses: courses.filter((c) => c.data.category === cat.slug),
})).filter((g) => g.courses.length > 0);


/* Antes 71-81 caracteres: Google cortaba justo la marca. Se conserva el conteo
   y la marca entra en los 8 países (≤60, ver conMarca). */
const title = conMarca(`Catálogo de ${courses.length}+ cursos online en ${country.name}`);

const description = `Explora todos los cursos online de Sably disponibles en ${country.name}: oficios, gastronomía, moda, emprendimiento y más. Certificado incluido.`;


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
return {cms,country,CATEGORIES,INTERNAL_CATEGORIES,base,courses,byCategory,title,description,schemas};
}
