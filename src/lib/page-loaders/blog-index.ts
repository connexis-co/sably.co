import { cmsImageUrl } from '@/lib/cms-media';
import { getContentRepository } from '@/lib/emdash-content';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { blogCover, readingTime, blogFacets } from '@/lib/blog';
import { breadcrumbSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();

const country = await cms.getCountry(DEFAULT_COUNTRY);

if (!country) return new Response('Not found',{status:404});

const posts = (await cms.getBlogPosts()).sort(
  (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
);

const facets = blogFacets(posts);

const [featured, ...rest] = posts;


const title = 'Blog de Sably | Guías para aprender oficios y emprender';

const description =
  'Guías prácticas, tendencias y consejos para aprender un oficio rentable y emprender en Latinoamérica.';


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}/co/` },
    { name: 'Blog', url: `${SITE.url}/blog/` },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE.url}/blog/#blog`,
    name: title,
    description,
    url: `${SITE.url}/blog/`,
    inLanguage: 'es',
    publisher: { '@id': `${SITE.url}/#organization` },
    // Los artículos van como referencias, no como copias del Article completo:
    // la ficha entera vive en cada post y duplicarla aquí solo crea dos
    // entidades para la misma URL.
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.data.title,
      description: post.data.description,
      url: `${SITE.url}/blog/${post.id}/`,
      datePublished: post.data.publishedAt.toISOString(),
      // Absoluta sin duplicar el dominio: blogCover ya trae la del CDN.
      image: new URL((cmsImageUrl(post.cardImage) ?? cmsImageUrl(post.coverImage) ?? blogCover(post.data.category, 'card')), SITE.url).href,
      author: { '@id': `${SITE.url}/#organization` },
    })),
  },
];
return {cms,country,posts,facets,featured,rest,title,description,schemas};
}
