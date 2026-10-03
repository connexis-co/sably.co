import { getLiveSiteSettings } from './live-site-settings';
import type { CollectionEntry } from 'astro:content';
import { DEFAULT_COUNTRY, localPrice, type Country } from './countries';
import { readOperationalPrice } from '@/plugins/sably-operations/public';
import { SITE } from './site';
import { getCountries } from './emdash-content';

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

/**
 * Genera alternates hreflang para páginas que existen en todos los países
 * (home país, categoría, curso). `pathAfterCountry` NO incluye el código de país.
 * Las city landings no llevan hreflang (no mapean 1:1 entre países).
 */
export async function countryAlternates(pathAfterCountry: string): Promise<HreflangAlternate[]> {
  const COUNTRIES = await getCountries();
  const clean = pathAfterCountry.startsWith('/') ? pathAfterCountry : `/${pathAfterCountry}`;
  const alternates: HreflangAlternate[] = COUNTRIES.map((c) => ({
    hreflang: c.hreflang,
    href: `${SITE.url}/${c.code}${clean}`,
  }));
  if (COUNTRIES.some(c => c.code === DEFAULT_COUNTRY)) alternates.push({
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

/** Largo a partir del cual Google corta el título en el resultado (~600 px). */
export const LIMITE_TITULO = 60;

/**
 * Añade « | Sably» al <title> cuando cabe.
 *
 * La marca en el título es una de las fuentes que Google usa para el nombre del
 * sitio y la que citan los LLM tal cual, pero solo 13 de 968 fichas de país la
 * llevaban. Se añade únicamente si el título no la nombra ya y el resultado
 * queda en ≤60 caracteres: pasado ese largo Google la corta igual, y recortar
 * el título para hacerle sitio le quitaría keywords.
 */
export function conMarca(titulo: string): string {
  const t = titulo.trim();
  if (/sably/i.test(t)) return t;
  const conSufijo = `${t} | ${SITE.name}`;
  return conSufijo.length <= LIMITE_TITULO ? conSufijo : t;
}

export async function organizationSchema() {
  const [COUNTRIES, settings] = await Promise.all([getCountries(), getLiveSiteSettings()]);
  return {
    '@context': 'https://schema.org',
    // EducationalOrganization es más específico que Organization y es lo que
    // Google espera como `provider` de un Course.
    '@type': ['Organization', 'EducationalOrganization'],
    '@id': `${SITE.url}/#organization`,
    name: settings.title || SITE.name,
    alternateName: 'Sably Cursos Online',
    // La raíz del dominio, no /co/: Google solo admite nombres de sitio a nivel de
    // dominio y la URL debe ser la misma en todas las homes. Que la raíz redirija a
    // /co/ está previsto en su guía: el nombre de sitio sigue al destino.
    url: `${SITE.url}/`,
    description: SITE.description,
    slogan: settings.tagline || SITE.tagline,
    logo: {
      '@type': 'ImageObject',
      // PNG 512px: Google exige ≥112x112 y prefiere raster sobre el SVG del favicon.
      url: settings.logo?.url ? new URL(settings.logo.url, SITE.url).href : `${SITE.url}/icon-512.png`,
      caption: settings.logo?.alt || settings.title || SITE.name,
    },
    // Solo perfiles que existen: un sameAs a un 404 es peor que no declararlo.
    sameAs: Object.values(settings.social ?? SITE.social).filter(Boolean),
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
  /**
   * URL CANÓNICA de la ficha: la del país también en la variante de ciudad.
   * De ella salen `@id`, `offers.url` y la `location` del CourseInstance, así
   * que el nodo sale idéntico en la ficha de país y en sus 37 de ciudad, que es
   * lo que pide Google para páginas duplicadas que canonizan a otra.
   */
  url: string;
  image?: string;
  price: number;
  priceCurrency: string;
  /**
   * Nombre del instructor. `undefined` cuando no hay uno verificado: en las
   * fichas sin producto el del frontmatter es inventado, y declarar una
   * `Person` con credenciales que nadie puede respaldar es peor en el marcado
   * que en la página, porque Google lo indexa como una entidad real.
   */
  instructorName?: string;
  /**
   * `false` cuando el curso todavía no tiene checkout.
   *
   * Sin producto no hay nada que ofertar: emitir un `Offer` con precio y
   * `InStock` para algo que no se puede comprar es marcado que no describe la
   * página, y puede pintar un resultado enriquecido con un precio que no lleva
   * a ninguna parte.
   */
  comprable?: boolean;
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

/**
 * Ficha del curso como Product + Course.
 *
 * Course solo ya no pinta precio en el resultado de Google en español; el
 * fragmento de producto sí, y lo admite para páginas donde el producto no se
 * compra en el propio sitio (aquí el pago va a Hotmart). No se aspira a
 * merchant listing: por eso no hay `seller`, `shippingDetails` ni política de
 * devoluciones, y tampoco `brand`, porque la marca del curso es su productor y
 * no Sably. Todo lo de Course (temario, credencial, CourseInstance) se conserva
 * para Bing y los asistentes.
 *
 * Un curso sin checkout («Próximamente») se queda en Course a secas: Google
 * exige en Product uno de offers, review o aggregateRating, y aquí no hay
 * ninguno, así que un Product vacío sería un elemento no válido en GSC.
 */
export function courseSchema(c: CourseSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': c.comprable === false ? 'Course' : ['Product', 'Course'],
    '@id': `${c.url}#curso`,
    name: c.title,
    description: c.description,
    url: c.url,
    ...(c.image ? { image: [c.image] } : {}),
    provider: { '@id': `${SITE.url}/#organization` },
    // Sin `instructor` a este nivel: schema.org solo lo admite en
    // CourseInstance (el validador da UNKNOWN_FIELD en Course). El instructor
    // sigue declarado en hasCourseInstance y visible en la página.
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
    ...(c.comprable === false
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price: c.price,
            priceCurrency: c.priceCurrency,
            availability: 'https://schema.org/InStock',
            category: 'Paid',
            url: c.url,
          },
        }),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: `PT${c.workloadHours}H`,
      location: { '@type': 'VirtualLocation', url: c.url },
      ...(c.instructorName ? { instructor: { '@type': 'Person', name: c.instructorName } } : {}),
    },
    inLanguage: 'es',
    availableLanguage: ['es'],
  };
}

interface CourseListEntry {
  name: string;
  url: string;
  description: string;
  /** `null` cuando no hay nada que ofertar (curso sin checkout): sin `offers`. */
  price: number | null;
  priceCurrency: string;
  workloadHours: number;
}

/**
 * Entrada del listado a partir del curso, con las mismas reglas que la ficha.
 *
 * - Precio: el real de Hotmart (`precioReal`), el mismo que pinta CourseCard
 *   al lado; el de catálogo solo si no hay real. Antes se usaba siempre el de
 *   catálogo y en /co/cursos/belleza-online/ los 26 importes del listado
 *   contradecían la tarjeta visible y la ficha.
 * - Cursos con `hotmartUrl` PENDIENTE: sin precio, porque no hay checkout y un
 *   Offer InStock describiría algo que no se puede comprar.
 * - URL canónica del país, también en los listados de ciudad: las fichas de
 *   ciudad canonizan al país y el listado no debe señalar la duplicada.
 *
 * Vive aquí y no en cada página para que categoría, hub de ciudad y
 * ciudad×categoría no vuelvan a divergir.
 */
export async function cursoParaListado(course: CollectionEntry<'courses'>, country: Country): Promise<CourseListEntry> {
  const sinProducto = /PENDIENTE/i.test(course.data.hotmartUrl);
  const [{env},{getRequestContext}] = await Promise.all([import('cloudflare:workers'),import('emdash/request-context')]);
  const real = await readOperationalPrice((env as unknown as {SABLY_DB:D1Database}).SABLY_DB, course.id, country, getRequestContext()).catch(() => null);
  return {
    name: course.data.title,
    url: `${SITE.url}/${country.code}/${course.id}/`,
    description: course.data.shortDescription,
    price: sinProducto ? null : real ? real.monto : localPrice(course.data.priceUSD, country),
    priceCurrency: real ? real.moneda : country.currency,
    workloadHours: course.data.durationHours,
  };
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
        ...(c.price === null
          ? {}
          : {
              offers: {
                '@type': 'Offer',
                price: c.price,
                priceCurrency: c.priceCurrency,
                availability: 'https://schema.org/InStock',
                category: 'Paid',
              },
            }),
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
 * La `url` es la raíz del dominio e IDÉNTICA en las 8 homes: Google no admite
 * nombres de sitio a nivel de subdirectorio y pide los mismos datos en todas
 * las variantes de la home. Antes cada una declaraba su /xx/ con el mismo @id,
 * o sea ocho definiciones distintas de un único sitio.
 *
 * `alternateName` recoge cómo se nombra la marca fuera de aquí: «Sably Academy»
 * es el canal real de YouTube (@sably.academy), que posiciona para «sably».
 *
 * No lleva `SearchAction`: Google retiró la caja de búsqueda de resultados en
 * noviembre de 2023 y el sitio no tiene buscador, así que declararla sería
 * marcado que no describe nada.
 */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    alternateName: ['Sably Cursos Online', 'Sably Academy', 'sably.co'],
    url: `${SITE.url}/`,
    description: SITE.description,
    inLanguage: 'es',
    publisher: { '@id': `${SITE.url}/#organization` },
  };
}

interface VideoInput {
  /** Título del vídeo. No el del curso a secas: describe lo que se ve. */
  name: string;
  description: string;
  /** Absoluta. Google rechaza las relativas. */
  thumbnailUrl: string;
  /** ISO 8601, la fecha real de subida. */
  uploadDate: string;
  /** ISO 8601 de duración: PT40S. Es la que pinta la insignia de tiempo. */
  duration: string;
  /** URL directa al MP4. */
  contentUrl: string;
  /** Página donde se reproduce. */
  pageUrl: string;
}

/**
 * Ficha de vídeo.
 *
 * Solo se emite cuando el vídeo existe de verdad en la página: Google exige que
 * el vídeo sea el contenido principal de ese punto de la página y penaliza
 * declarar uno que no se puede reproducir.
 *
 * `duration` y `uploadDate` salen del archivo real (ver course-videos.ts), no
 * del frontmatter del curso: la fecha de publicación del curso no es cuándo se
 * subió el vídeo, y una duración inventada rompe la insignia del resultado.
 */
export function videoSchema(v: VideoInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.name,
    description: v.description,
    thumbnailUrl: [v.thumbnailUrl],
    uploadDate: v.uploadDate,
    duration: v.duration,
    contentUrl: v.contentUrl,
    // Dónde vive el vídeo, para que Google lo asocie a esta URL y no a otra.
    embedUrl: v.pageUrl,
    inLanguage: 'es',
    isFamilyFriendly: true,
    publisher: { '@id': `${SITE.url}/#organization` },
  };
}
