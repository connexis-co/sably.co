import { cmsImageUrl } from '@/lib/cms-media';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { getContentRepository } from '@/lib/emdash-content';
import { categoryCover } from '@/lib/categories';
import { buildWhatsAppUrl } from '@/lib/hotmart';
import { faqSchema, breadcrumbSchema, itemListSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();

const country = await cms.getCountry(DEFAULT_COUNTRY);

if (!country) return new Response('Not found',{status:404});

const PROGRAMAS = await cms.getPrograms();

const SEDES = [...new Map(PROGRAMAS.flatMap(p => p.locations).map(s => [s.city, s])).values()];

const waUrl = buildWhatsAppUrl(
  country.whatsapp,
  'Hola, quiero información sobre la homologación y certificación de mi experiencia',
);


const faqs = [
  {
    q: '¿Qué es la homologación por validación de saberes?',
    a: 'Es un mecanismo de la formación para el trabajo en Colombia: si ya dominas un oficio por experiencia, una institución autorizada evalúa tus conocimientos y habilidades y, si apruebas, certifica tu competencia sin que repitas toda la formación desde cero.',
  },
  {
    q: '¿Quién emite el certificado?',
    a: 'Instituciones de formación para el trabajo y desarrollo humano (ETDH) aliadas, con sedes en Bogotá, Florencia (Caquetá), Neiva, Supía y Anserma (Caldas). Sably te conecta con ellas y te acompaña en el proceso.',
  },
  {
    q: '¿Cómo es el proceso?',
    a: 'Nos escribes por WhatsApp, te contamos requisitos y costos del programa, la institución evalúa tu experiencia y conocimientos, y si cumples el perfil recibes tu certificación.',
  },
  {
    q: '¿Cuánto cuesta y cuánto demora?',
    a: 'Depende del programa y de la evaluación que necesites. Al escribirnos por WhatsApp te damos la información exacta de tu caso, sin compromiso.',
  },
  {
    q: '¿Sirve para trabajar formalmente?',
    a: 'Sí: la certificación técnica laboral es el requisito que piden salones, spas, barberías y empleadores formales en Colombia.',
  },
];


const title = 'Homologa tu Experiencia y Certifícate | Validación de Saberes | Sably';

const description =
  'Certifica tu experiencia en belleza, barbería, estética y más con instituciones de formación para el trabajo aliadas en Bogotá, Neiva, Florencia y Caldas. Te asesoramos por WhatsApp.';


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}/co/` },
    { name: 'Homologaciones', url: `${SITE.url}/homologaciones/` },
  ]),
  faqSchema(faqs),
  // Listado de programas homologables: refuerza el listado ante Google/LLMs.
  itemListSchema(PROGRAMAS.map((p) => ({ name: p.name, url: `${SITE.url}/homologaciones/${p.slug}/` }))),
];
return {cms,country,PROGRAMAS,SEDES,waUrl,faqs,title,description,schemas};
}
