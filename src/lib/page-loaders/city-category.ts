import { cmsImageUrl } from '@/lib/cms-media';
import { getContentRepository } from '@/lib/emdash-content';
import { categoryCover } from '@/lib/categories';
import { breadcrumbSchema, faqSchema, courseListSchema, cursoParaListado } from '@/lib/seo';
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

const category = await cms.getCategory(Astro.params.category!);

if (!category || category.externalUrl) return new Response('Not found', {status:404});

Astro.locals.sablyContent = category.contentRef;

Astro.locals.sablySeo = category.seo;

const base = `/${country.code}`;


/* «Belleza Online» ya trae «Online»; sin limpiarlo las FAQ decían «belleza
   online online». Ver la nota en la variante de categoría a nivel país. */
const catName = category.name.replace(/\s+Online$/i, '');


const courses = (await cms.getCourses()).filter((c) => c.data.category === category.slug);


const faqs = [
  {
    q: `¿Puedo estudiar ${catName.toLowerCase()} online desde ${city.name}?`,
    a: `Sí. Los cursos de ${catName.toLowerCase()} de Sably son 100% online: estudia desde ${city.name} a tu ritmo, con acceso de por vida y acompañamiento por WhatsApp.`,
  },
  {
    q: `¿Cuánto cuesta un curso de ${catName.toLowerCase()} en ${city.name}?`,
    a: `Mucho menos que una academia presencial: los precios están en ${country.currency} y, cuando hay campaña activa, el descuento se aplica automáticamente.`,
  },
  {
    q: '¿Incluye certificado?',
    a: 'Sí, cada curso incluye certificado digital de finalización para tu hoja de vida.',
  },
  {
    q: `¿Me sirve para emprender en ${city.name}?`,
    a: `Ese es el objetivo: aprender un oficio con demanda real en ${city.name} para generar ingresos por tu cuenta o mejorar tu empleo actual.`,
  },
];


const title = `Cursos de ${catName} Online en ${city.name}, ${country.name} | Sably`;

const description = `Aprende ${catName.toLowerCase()} online desde ${city.name}. ${category.description} Precios en ${country.currency}.`;


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}${base}/` },
    { name: city.name, url: `${SITE.url}${base}/${city.slug}/` },
    { name: category.name, url: `${SITE.url}${base}/${city.slug}/cursos/${category.slug}/` },
  ]),
  faqSchema(faqs),
  // Carrusel de cursos: cada elemento lleva la ficha mínima (precio, duración,
  // proveedor) que Google pide para mostrar el listado como resultado rico.
  // Con la URL canónica del país, no la de ciudad: esas fichas canonizan allí.
  courseListSchema(await Promise.all(courses.map((c) => cursoParaListado(c, country)))),
];
return {cms,country,CATEGORIES,INTERNAL_CATEGORIES,city,category,base,catName,courses,faqs,title,description,schemas};
}
