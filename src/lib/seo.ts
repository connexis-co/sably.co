import { COUNTRIES, DEFAULT_COUNTRY } from './countries';
import { SITE } from './site';

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

/**
 * Genera alternates hreflang para páginas que existen en todos los países
 * (home país, categoría, curso). `pathAfterCountry` NO incluye el código de país.
 * Las city landings no llevan hreflang (no mapean 1:1 entre países).
 */
export function countryAlternates(pathAfterCountry: string): HreflangAlternate[] {
  const clean = pathAfterCountry.startsWith('/') ? pathAfterCountry : `/${pathAfterCountry}`;
  const alternates: HreflangAlternate[] = COUNTRIES.map((c) => ({
    hreflang: c.hreflang,
    href: `${SITE.url}/${c.code}${clean}`,
  }));
  alternates.push({
    hreflang: 'x-default',
    href: `${SITE.url}/${DEFAULT_COUNTRY}${clean}`,
  });
  return alternates;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    // EducationalOrganization es más específico que Organization y es lo que
    // Google espera como `provider` de un Course.
    '@type': ['Organization', 'EducationalOrganization'],
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    alternateName: 'Sably Cursos Online',
    url: SITE.url,
    description: SITE.description,
    slogan: SITE.tagline,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE.url}/favicon.svg`,
      caption: SITE.name,
    },
    // Solo perfiles que existen: un sameAs a un 404 es peor que no declararlo.
    sameAs: Object.values(SITE.social).filter(Boolean),
    // El área servida sale de los países que el sitio realmente publica, no de
    // una lista aspiracional.
    areaServed: COUNTRIES.map((c) => ({ '@type': 'Country', name: c.name })),
  };
}

interface FaqEntry {
  q: string;
  a: string;
}

export function faqSchema(faqs: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

interface CourseSchemaInput {
  title: string;
  description: string;
  url: string;
  image?: string;
  price: number;
  priceCurrency: string;
  instructorName: string;
  category: string;
  workloadHours: number;
  /** `learnings` del curso → `teaches`, que Google muestra en Course Info. */
  teaches?: string[];
  level?: string;
  /** Títulos de los módulos → temario. */
  syllabus?: string[];
  datePublished?: string;
  /**
   * Solo se emite `aggregateRating` si viene de reseñas reales verificadas
   * contra una compra. Google exige que la nota provenga de usuarios y que
   * esté visible en la página; una nota de catálogo es marcado spam y se
   * sanciona con acción manual. Mientras la tabla `review` de D1 esté vacía
   * esto queda en `undefined` y no se emite nada.
   */
  rating?: { value: number; count: number };
}

/** Traduce el nivel del catálogo al vocabulario que entiende Google. */
const NIVEL: Record<string, string> = {
  Principiante: 'Beginner',
  Intermedio: 'Intermediate',
  Avanzado: 'Advanced',
  'Todos los niveles': 'Beginner',
};

export function courseSchema(c: CourseSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: c.description,
    url: c.url,
    ...(c.image ? { image: c.image } : {}),
    provider: { '@id': `${SITE.url}/#organization` },
    instructor: { '@type': 'Person', name: c.instructorName },
    about: c.category,
    ...(c.teaches?.length ? { teaches: c.teaches } : {}),
    ...(c.level && NIVEL[c.level] ? { educationalLevel: NIVEL[c.level] } : {}),
    ...(c.syllabus?.length
      ? {
          syllabusSections: c.syllabus.map((title, i) => ({
            '@type': 'Syllabus',
            name: title,
            position: i + 1,
          })),
        }
      : {}),
    // Todos los cursos entregan certificado digital de finalización: es una
    // propiedad real del producto, no una promesa de marketing.
    educationalCredentialAwarded: {
      '@type': 'EducationalOccupationalCredential',
      name: 'Certificado digital de finalización',
      credentialCategory: 'Certificate',
    },
    timeRequired: `PT${c.workloadHours}H`,
    // Solo se declara «sin requisitos» donde es cierto: un curso marcado como
    // Intermedio o Avanzado sí parte de una base.
    ...(c.level === 'Principiante' || c.level === 'Todos los niveles'
      ? { coursePrerequisites: 'Sin requisitos previos' }
      : {}),
    isAccessibleForFree: false,
    ...(c.datePublished ? { datePublished: c.datePublished } : {}),
    ...(c.rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: c.rating.value,
            ratingCount: c.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      price: c.price,
      priceCurrency: c.priceCurrency,
      availability: 'https://schema.org/InStock',
      category: 'Paid',
      url: c.url,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: `PT${c.workloadHours}H`,
      location: { '@type': 'VirtualLocation', url: c.url },
      instructor: { '@type': 'Person', name: c.instructorName },
    },
    inLanguage: 'es',
    availableLanguage: ['es'],
  };
}

interface CourseListEntry {
  name: string;
  url: string;
  description: string;
  price: number;
  priceCurrency: string;
  workloadHours: number;
}

/**
 * Listado de cursos en formato "resumen": ItemList de Course con la ficha
 * mínima que pide Google para el carrusel de cursos. Es el marcado propio de
 * las páginas de categoría, distinto del ItemList genérico de enlaces.
 */
export function courseListSchema(cursos: CourseListEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: cursos.length,
    itemListElement: cursos.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: c.name,
        description: c.description,
        url: c.url,
        provider: { '@id': `${SITE.url}/#organization` },
        offers: {
          '@type': 'Offer',
          price: c.price,
          priceCurrency: c.priceCurrency,
          availability: 'https://schema.org/InStock',
          category: 'Paid',
        },
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'Online',
          courseWorkload: `PT${c.workloadHours}H`,
        },
      },
    })),
  };
}

interface ListItem {
  name: string;
  url: string;
}

/**
 * Listado ordenado de enlaces.
 *
 * En páginas de catálogo le dice a Google que esto es una lista y no prosa,
 * lo que habilita los enlaces de sitio bajo el resultado.
 */
export function itemListSchema(items: ListItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

/**
 * Identidad del sitio para la home de cada país.
 *
 * Es lo que alimenta el nombre del sitio en el resultado: Google muestra
 * «Sably» en vez de «sably.co» cuando encuentra este marcado en la raíz.
 *
 * No lleva `SearchAction`: Google retiró la caja de búsqueda de resultados en
 * noviembre de 2023 y el sitio no tiene buscador, así que declararla sería
 * marcado que no describe nada.
 */
export function websiteSchema(country: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    alternateName: 'Sably Cursos Online',
    url: `${SITE.url}/${country}/`,
    description: SITE.description,
    inLanguage: 'es',
    publisher: { '@id': `${SITE.url}/#organization` },
  };
}
