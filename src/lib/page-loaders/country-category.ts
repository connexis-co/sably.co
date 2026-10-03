import { cmsImageUrl } from '@/lib/cms-media';
import { getContentRepository } from '@/lib/emdash-content';
import { categoryCover } from '@/lib/categories';
import { countryAlternates, breadcrumbSchema, faqSchema, courseListSchema, cursoParaListado } from '@/lib/seo';
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

const category = await cms.getCategory(Astro.params.category!);

if (!category || category.externalUrl) return new Response('Not found', {status:404});

Astro.locals.sablyContent = category.contentRef;

Astro.locals.sablySeo = category.seo;

const base = `/${country.code}`;


/* El template añade "Online" al nombre; la categoría 'belleza-online' ya lo
   lleva en su `name`, así que sin esto el título salía «Belleza Online Online».
   Se limpia una vez y se usa en title, H1 y las FAQ (que van al FAQPage). El
   slug y el name «Belleza Online» de los chips del home no se tocan. */
const catName = category.name.replace(/\s+Online$/i, '');


const courses = (await cms.getCourses()).filter((c) => c.data.category === category.slug);

const bySubcategory = category.subcategories
  .map((sub) => ({
    sub,
    courses: courses.filter((c) => c.data.subcategory === sub.slug),
  }))
  .filter((g) => g.courses.length > 0);

const uncategorized = courses.filter(
  (c) => !category.subcategories.some((s) => s.slug === c.data.subcategory),
);


const faqs = [
  {
    q: `¿Puedo aprender ${catName.toLowerCase()} online desde ${country.name}?`,
    a: `Sí. Los cursos de ${catName.toLowerCase()} de Sably son 100% online, con clases en video paso a paso que puedes ver a tu ritmo desde cualquier ciudad de ${country.name}.`,
  },
  {
    q: '¿Los cursos incluyen certificado?',
    a: 'Sí, al completar cada curso recibes un certificado digital de finalización.',
  },
  {
    q: '¿Cuánto cuestan los cursos?',
    a: `Los precios se muestran en ${country.currency}. Cuando hay una campaña activa, el descuento se aplica automáticamente al inscribirte desde Sably.`,
  },
  {
    q: '¿Por cuánto tiempo tengo acceso?',
    a: 'El acceso es de por vida: pagas una sola vez y puedes repasar las clases cuando quieras.',
  },
];


/* Marca fija, sin conMarca: con ella /us/cursos/panaderia-y-pasteleria/ pasaba
   de 60 caracteres y perdía « | Sably». */
const title = `Cursos de ${catName} Online en ${country.name} | Sably`;

const description = `${category.description} Cursos online con certificado para ${country.name}, con acceso de por vida.`;


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}${base}/` },
    { name: 'Cursos', url: `${SITE.url}${base}/cursos/` },
    { name: category.name, url: `${SITE.url}${base}/cursos/${category.slug}/` },
  ]),
  faqSchema(faqs),
  // Carrusel de cursos: cada elemento lleva la ficha mínima (precio, duración,
  // proveedor) que Google pide para mostrar el listado como resultado rico.
  // Precio real (el de la tarjeta) y sin oferta en los cursos sin checkout.
  courseListSchema(await Promise.all(courses.map((c) => cursoParaListado(c, country)))),
];
return {cms,country,CATEGORIES,INTERNAL_CATEGORIES,category,base,catName,courses,bySubcategory,uncategorized,faqs,title,description,schemas};
}
