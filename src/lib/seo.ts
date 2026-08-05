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
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/favicon.svg`,
    sameAs: Object.values(SITE.social),
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
  priceUSD: number;
  rating: number;
  ratingCount: number;
  instructorName: string;
  category: string;
}

export function courseSchema(c: CourseSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: c.description,
    url: c.url,
    provider: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
    instructor: { '@type': 'Person', name: c.instructorName },
    about: c.category,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: c.rating,
      ratingCount: c.ratingCount,
      bestRating: 5,
    },
    offers: {
      '@type': 'Offer',
      price: c.priceUSD,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      category: 'Paid',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: 'PT10H',
    },
  };
}
