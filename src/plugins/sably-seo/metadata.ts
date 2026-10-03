import type { PageMetadataContribution, PublicPageContext } from 'emdash';

export type SablyArticlePage = PublicPageContext & { sablyArticle?: Record<string, unknown> };
/** Compose the template's public CMS article through EmDash's deduplicated head. */
export function articleMetadata(page: SablyArticlePage): PageMetadataContribution[] | null {
  const article = page.sablyArticle;
  if (page.pageType !== 'article' || page.content?.collection !== 'blog' || !article || article['@type'] !== 'Article') return null;
  const canonical = page.canonical || page.url;
  const rawImage = page.seo?.ogImage || page.image || article.image;
  let image = article.image;
  if (typeof rawImage === 'string') {
    try { const url = new URL(rawImage, page.siteUrl || page.url); if (['https:', 'http:'].includes(url.protocol)) image = url.href; }
    catch { /* Preserve the already resolved image from the public loader. */ }
  }
  return [{ kind: 'jsonld', id: 'primary', graph: {
    ...article,
    headline: page.seo?.ogTitle || page.pageTitle || page.title || article.headline,
    description: page.seo?.ogDescription || page.description || article.description,
    image,
    url: canonical,
    datePublished: page.articleMeta?.publishedTime || article.datePublished,
    dateModified: page.articleMeta?.modifiedTime || article.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  } }];
}
