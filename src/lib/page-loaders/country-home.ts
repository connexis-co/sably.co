import { publicStats } from '@/lib/public-stats';
import { cmsImageUrl } from '@/lib/cms-media';
import { getContentRepository } from '@/lib/emdash-content';
import { readOperationalRatings } from '@/plugins/sably-operations/public';
import { env } from 'cloudflare:workers';
import { LIMITE_TITULO, countryAlternates, faqSchema, websiteSchema } from '@/lib/seo';
import { SITE, CDN_URL } from '@/lib/site';
import { HERO_ASSETS } from '@/lib/hero-assets';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();
const ratings = await readOperationalRatings((env as unknown as {SABLY_DB:D1Database}).SABLY_DB, Astro.locals).catch(() => ({} as Awaited<ReturnType<typeof readOperationalRatings>>));
const valoracionReal = (slug:string) => ratings[slug] ?? null;

const stats = await publicStats(Astro.locals);
const country = await cms.getCountry(Astro.params.country!);

if (!country) return new Response('Not found', {status:404});

Astro.locals.sablyContent = country.contentRef;

Astro.locals.sablySeo = country.seo;

const CATEGORIES = await cms.getCategories();

const INTERNAL_CATEGORIES = CATEGORIES.filter(c => !c.externalUrl);

const base = `/${country.code}`;


const allCourses = await cms.getCourses();

const featured = [...allCourses]
  .sort((a, b) => Number(b.data.featured) - Number(a.data.featured) || (valoracionReal(b.id)?.total ?? 0) - (valoracionReal(a.id)?.total ?? 0))
  .slice(0, 8);


const allTestimonials = await cms.getTestimonials();

const localTestimonials = allTestimonials.filter((t) => t.data.countryCode === country.code);

const testimonials = (localTestimonials.length >= 3 ? localTestimonials : allTestimonials).slice(0, 6);


const posts = (await cms.getBlogPosts())
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
  .slice(0, 3);


const faqs = [
  {
    q: `¿Los cursos de Sably están disponibles en ${country.name}?`,
    a: `Sí. Todos nuestros cursos son 100% online y puedes tomarlos desde cualquier ciudad de ${country.name}, a tu ritmo y con acceso de por vida. Los precios se muestran en ${country.currency}.`,
  },
  {
    q: '¿Recibo un certificado al terminar?',
    a: 'Sí, todos los cursos incluyen certificado digital de finalización que puedes compartir en tu hoja de vida y redes profesionales.',
  },
  {
    q: '¿Cómo se realiza el pago?',
    a: `El pago se procesa de forma segura a través de Hotmart, la plataforma líder de cursos online en Latinoamérica. Aceptamos tarjetas y métodos de pago locales de ${country.name}.`,
  },
  {
    q: '¿Qué pasa si el curso no me gusta?',
    a: 'Tienes 7 días de garantía: si el curso no cumple tus expectativas, pides en Hotmart el reembolso del 100 % de tu dinero.',
  },
  {
    q: '¿Necesito experiencia previa?',
    a: 'No. La mayoría de nuestros cursos parten desde cero y te llevan paso a paso hasta un nivel profesional.',
  },
];


/* La marca delante: al final se truncaba (68 caracteres en /co/) y la home es
   la página que más pesa para el nombre de sitio. Si el país no cabe en 60
   (Estados Unidos) se cae a la variante corta sin «con certificado». */
const tituloLargo = `Sably: cursos online de oficios con certificado en ${country.name}`;

const title = tituloLargo.length <= LIMITE_TITULO ? tituloLargo : `Sably: cursos online de oficios en ${country.name}`;

const description = `Aprende panadería, costura, electricidad, gastronomía y más oficios rentables desde ${country.name}. Cursos online con certificado y acceso de por vida.`;
return {stats,cms,country,CATEGORIES,INTERNAL_CATEGORIES,base,allCourses,featured,allTestimonials,localTestimonials,testimonials,posts,faqs,tituloLargo,title,description};
}
