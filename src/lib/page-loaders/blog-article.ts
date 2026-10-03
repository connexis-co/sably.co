import { cmsImageUrl } from '@/lib/cms-media';
import { getContentRepository } from '@/lib/emdash-content';
import { richText, prepareRichContent } from '@/lib/rich-content';
import { renderMarkdown } from '@/lib/markdown';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { breadcrumbSchema, faqSchema } from '@/lib/seo';
import { blogCover, readingTime } from '@/lib/blog';
import { SITE } from '@/lib/site';
import type { PublicPageContext } from './types';

export async function load(Astro:PublicPageContext) {


const cms = await getContentRepository();

const [post,country] = await Promise.all([cms.getBlogPost(Astro.params.slug ?? ''),cms.getCountry(DEFAULT_COUNTRY)]);

if (!post || !country) return new Response('Not found',{status:404});

Astro.locals.sablyContent = post.contentRef;

Astro.locals.sablySeo = post.seo;

const headings = post.richBody ? prepareRichContent(post.richBody).headings : [];

const bodyText = post.richBody ? richText(post.richBody) : post.body ?? '';

/** TOC: solo H2/H3; Astro ya genera los ids con rehype-slug. */
const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);


const related = (await cms.getBlogPosts())
  .filter((p) => p.id !== post.id)
  .sort((a, b) => Number(b.data.category === post.data.category) - Number(a.data.category === post.data.category))
  .slice(0, 3);


const minutes = readingTime(bodyText);

/* « | Sably» siempre, más corto que el antiguo « | Blog Sably». No se usa
   conMarca (que la omite si pasa de 60 caracteres): con ella 9 de los 11 posts
   perdían la marca, y en el blog se prefiere la marca aunque Google corte. */
const title = `${post.data.title} | ${SITE.name}`;

const pageUrl = `${SITE.url}/blog/${post.id}/`;


const schemas = [
  breadcrumbSchema([
    { name: 'Inicio', url: `${SITE.url}/co/` },
    { name: 'Blog', url: `${SITE.url}/blog/` },
    { name: post.data.title, url: pageUrl },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.data.title,
    description: post.data.description,
    /* blogCover ya devuelve la URL absoluta del CDN: concatenarle SITE.url daba
       «https://sably.cohttps://cdn…», una imagen imposible de rastrear. new URL
       deja intacta la absoluta y resuelve la relativa (entorno sin CDN). */
    image: new URL((cmsImageUrl(post.coverImage) ?? blogCover(post.data.category, 'hero')), SITE.url).href,
    datePublished: post.data.publishedAt.toISOString(),
    dateModified: post.updatedAt,
    inLanguage: 'es',
    wordCount: bodyText.trim().split(/\s+/).length,
    timeRequired: `PT${minutes}M`,
    keywords: (post.data.keywords ?? []).join(', '),
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    author: { '@id': `${SITE.url}/#organization` },
    publisher: { '@id': `${SITE.url}/#organization` },
    isPartOf: { '@id': `${SITE.url}/blog/#blog` },
    /* Sin aggregateRating: Search Console lo rechazaba ("el tipo de objeto del
       campo parent_node no es válido") porque Article no es un tipo válido
       para fragmentos de reseña. Y el número que declaraba salía de un hash
       del slug, o sea reseñas que no existen. */
  },
  // FAQPage solo si el post declara `faq` (se renderiza visible abajo, para que
  // schema y DOM coincidan). Es el formato que más citan Google/LLMs.
  ...(post.data.faq?.length ? [faqSchema(post.data.faq)] : []),
];
const articleSchema = schemas.find(schema => schema['@type'] === 'Article');
const articleMeta = { publishedTime: post.data.publishedAt.toISOString(), modifiedTime: post.updatedAt, author: `${SITE.url}/#organization` };
return {cms,post,country,headings,bodyText,toc,related,minutes,title,pageUrl,articleSchema,articleMeta,schemas:schemas.filter(schema => schema['@type'] !== 'Article')};
}
