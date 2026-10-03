import { cmsImageUrl } from '@/lib/cms-media';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { getContentRepository } from '@/lib/emdash-content';
import { categoryCover } from '@/lib/categories';
import { buildWhatsAppUrl } from '@/lib/hotmart';
import { faqSchema, breadcrumbSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { PublicPageContext } from './types';
import { conciseTitle } from '../seo-title';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();

const country = await cms.getCountry(DEFAULT_COUNTRY);

if (!country) return new Response('Not found',{status:404});

const PROGRAMAS = await cms.getPrograms();

const programa = await cms.getProgram(Astro.params.programa!);

if (!programa) return new Response('Not found',{status:404});

Astro.locals.sablyContent = programa.contentRef;

Astro.locals.sablySeo = programa.seo;

const SEDES = programa.locations;

const waUrl = buildWhatsAppUrl(
  country.whatsapp,
  `Hola, quiero información sobre la homologación de ${programa.name}`,
);


const faqs = [
  {
    q: `¿Puedo certificarme en ${programa.name} solo con mi experiencia?`,
    a: 'Si dominas el oficio, la institución aliada evalúa tus conocimientos y habilidades mediante validación de saberes previos. Si apruebas la evaluación, certificas tu competencia sin repetir toda la formación.',
  },
  {
    q: '¿Qué me van a evaluar?',
    a: programa.evaluacion.join('. ') + '.',
  },
  {
    q: '¿Cuánto cuesta y cuánto demora?',
    a: 'Depende de tu caso y de la evaluación necesaria. Escríbenos por WhatsApp y te damos la información exacta del programa, sin compromiso.',
  },
  {
    q: '¿El certificado es válido para trabajar?',
    a: 'La certificación la emite una institución de formación para el trabajo (ETDH) autorizada, que es el respaldo que exigen empleadores y establecimientos formales en Colombia.',
  },
  {
    q: '¿Atienden mi ciudad?',
    a: `Hay sedes en ${SEDES.map((s) => s.city).join(', ')} y el proceso de asesoría es 100% por WhatsApp para todo Colombia.`,
  },
];


const title = conciseTitle(`Homologación en ${programa.name}`);

const description = programa.shortDescription;


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}/co/` },
    { name: 'Homologaciones', url: `${SITE.url}/homologaciones/` },
    { name: programa.name, url: `${SITE.url}/homologaciones/${programa.slug}/` },
  ]),
  faqSchema(faqs),
];
return {cms,country,PROGRAMAS,programa,SEDES,waUrl,faqs,title,description,schemas};
}
