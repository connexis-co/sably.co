#!/usr/bin/env node
/** Read-only HTTP audit. Four concurrent requests; preview credentials never leave dev.sably.co. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

export const ORIGIN = 'https://dev.sably.co';
const allowedOrigins = new Set([ORIGIN, 'https://sably.co', 'https://www.sably.co']);
function walk(node, visit) { visit(node); for (const child of node.childNodes ?? []) walk(child, visit); }
const attributes = node => Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value]));
function typesOf(value, types = [], articles = []) {
  if (Array.isArray(value)) { for (const item of value) typesOf(item, types, articles); }
  else if (value && typeof value === 'object') {
    const ownTypes = value['@type'] ? (Array.isArray(value['@type']) ? value['@type'] : [value['@type']]) : [];
    types.push(...ownTypes);
    if (ownTypes.some(type => type === 'Article' || type === 'BlogPosting')) articles.push(value);
    for (const child of Object.values(value)) if (child && typeof child === 'object') typesOf(child, types, articles);
  }
  return types.filter(type => typeof type === 'string');
}
export function targetURL(value) {
  const url = new URL(value, ORIGIN);
  assert.ok(allowedOrigins.has(url.origin) && !url.username && !url.password, 'Refusing a sitemap target outside reviewed Sably origins');
  return new URL(url.pathname + url.search, ORIGIN).href;
}
export function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)].map(match => match[1].trim().replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'"));
}

export function inspectHTML(html, pageURL) {
  const document = parse(html), issues = [], canonical = [], imageSources = [], schemaTypes = [], articleGraphs = [];
  let titles = 0, jsonLdCount = 0, images = 0;
  walk(document, node => {
    const attrs = attributes(node);
    if (node.tagName === 'title') titles++;
    if (node.tagName === 'link' && (attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')) canonical.push(attrs.href ?? '');
    if (node.tagName === 'img') {
      images++;
      const source = (attrs.src ?? '').trim();
      if (!source && !(attrs.srcset ?? '').trim()) issues.push('image-without-source');
      if (source) {
        try {
          const url = new URL(source, pageURL);
          if (!['http:', 'https:', 'data:'].includes(url.protocol) || url.username || url.password || /\[object Object\]|undefined|null/.test(source)) issues.push('invalid-image-source');
          else if (url.protocol !== 'data:') imageSources.push(url.href);
        } catch { issues.push('invalid-image-source'); }
      }
    }
    if (node.tagName === 'script' && (attrs.type ?? '').toLowerCase() === 'application/ld+json') {
      jsonLdCount++;
      try { schemaTypes.push(...typesOf(JSON.parse((node.childNodes ?? []).map(child => child.value ?? '').join('')), [], articleGraphs)); }
      catch { issues.push('invalid-jsonld'); }
    }
    if ((node.tagName === 'script' || node.tagName === 'iframe') && /googletagmanager\.com\/(?:gtm\.js|gtag\/js|ns\.html)/.test(attrs.src ?? '')) issues.push('production-tracking-in-development');
    if (node.tagName === 'script' && !attrs.src && /googletagmanager\.com\/(?:gtm\.js|gtag\/js)/.test((node.childNodes ?? []).map(child => child.value ?? '').join(''))) issues.push('production-tracking-in-development');
  });
  if (titles !== 1) issues.push(`title-count:${titles}`);
  if (canonical.length !== 1) issues.push(`canonical-count:${canonical.length}`);
  else {
    try {
      const url = new URL(canonical[0]);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('protocol');
      if (!allowedOrigins.has(url.origin)) issues.push('canonical-outside-sably');
      if (url.pathname !== new URL(pageURL).pathname) issues.push('canonical-path-differs');
      if (url.search || url.hash) issues.push('canonical-query-or-fragment');
    } catch { issues.push('invalid-canonical'); }
  }
  if (!jsonLdCount) issues.push('jsonld-missing');
  if (schemaTypes.filter(type => type === 'WebSite').length > 1) issues.push('duplicate-website-schema');
  if (articleGraphs.length > 1) issues.push('duplicate-article-schema');
  if (/^\/[a-z]{2}\/curso-[^/]+\/$/.test(new URL(pageURL).pathname)) {
    if (!schemaTypes.includes('Course')) issues.push('course-schema-missing');
    if (schemaTypes.some(type => type === 'Article' || type === 'BlogPosting')) issues.push('article-schema-on-course');
  }
  const articleDetails = articleGraphs.map(graph => ({ type: graph['@type'], authorId: graph.author?.['@id'], publisherId: graph.publisher?.['@id'], hasPublishedTime: !!graph.datePublished, hasModifiedTime: !!graph.dateModified, hasLanguage: !!graph.inLanguage, hasWordCount: typeof graph.wordCount === 'number', hasReadingTime: !!graph.timeRequired, hasKeywords: typeof graph.keywords === 'string', hasBlogReference: !!graph.isPartOf?.['@id'] }));
  return { issues: [...new Set(issues)], canonical: canonical[0] ?? null, titleCount: titles, jsonLdCount, schemaTypes: [...new Set(schemaTypes)], articleDetails, imageCount: images, imageSources: [...new Set(imageSources)] };
}

export async function parallelMap(items, worker, concurrency = 4) {
  const results = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await worker(items[index], index); }
  }));
  return results;
}

export async function runAudit({ expectedCount = 981, reportPath = 'docs/dev-route-audit.json', fetcher = fetch, log = console.log } = {}) {
  const local = existsSync('.dev.vars') ? parseEnv(readFileSync('.dev.vars', 'utf8')) : {};
  const password = process.env.SABLY_DEV_PASSWORD || local.SABLY_DEV_PASSWORD;
  assert.ok(password, 'Missing SABLY_DEV_PASSWORD; no requests sent');
  const request = async (url, method = 'GET') => {
    assert.equal(new URL(url).origin, ORIGIN, 'Preview headers may only be sent to development');
    return fetcher(url, { method, redirect: 'manual', signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': 'SablyMigrationRouteAudit/1.0', 'X-Sably-Preview-Token': password } });
  };
  const startedAt = new Date().toISOString();
  const indexResponse = await request(ORIGIN + '/sitemap-index.xml');
  assert.equal(indexResponse.status, 200, 'Development sitemap index unavailable; audit stopped');
  const sitemapUrls = sitemapLocations(await indexResponse.text()).map(targetURL);
  assert.ok(sitemapUrls.length > 0 && sitemapUrls.length < 100, 'Unexpected sitemap index');
  const sitemaps = await parallelMap(sitemapUrls, async url => {
    const response = await request(url);
    assert.equal(response.status, 200, `Sitemap unavailable: ${new URL(url).pathname}`);
    return { path: new URL(url).pathname, urls: sitemapLocations(await response.text()).map(targetURL) };
  });
  const urls = [...new Set(sitemaps.flatMap(map => map.urls))].sort();
  assert.ok(urls.length > 0 && urls.length < 10_000, 'Unexpected URL count; audit stopped');
  log(`Auditing ${urls.length} sitemap URLs with four workers.`);
  let completed = 0;
  const results = await parallelMap(urls, async url => {
    const path = new URL(url).pathname;
    try {
      const response = await request(url), contentType = response.headers.get('content-type') ?? '';
      const text = await response.text(), issues = [];
      if (response.status !== 200) issues.push(`http:${response.status}`);
      if (!/text\/html/i.test(contentType)) issues.push('not-html');
      if (!/noindex/i.test(response.headers.get('x-robots-tag') ?? '')) issues.push('development-noindex-header-missing');
      if (!/no-store/i.test(response.headers.get('cache-control') ?? '')) issues.push('development-no-store-missing');
      const html = response.status === 200 && /text\/html/i.test(contentType) ? inspectHTML(text, url) : { issues: [], imageSources: [] };
      const result = { path, status: response.status, ...html, issues: [...issues, ...html.issues] };
      if (result.issues.length) log(JSON.stringify({ path, status: result.status, issues: result.issues }));
      return result;
    } catch (error) { log(JSON.stringify({ path, issues: ['request-failed'] })); return { path, status: null, issues: ['request-failed'], error: error instanceof Error ? error.name : 'Error', imageSources: [] }; }
    finally { if (++completed % 50 === 0) log(`Pages checked: ${completed}/${urls.length}`); }
  });
  const localImages = [...new Set(results.flatMap(result => result.imageSources))].filter(url => new URL(url).origin === ORIGIN).sort();
  let imagesCompleted = 0;
  log(`Checking ${localImages.length} unique same-origin images with HEAD.`);
  const images = await parallelMap(localImages, async url => {
    try {
      const response = await request(url, 'HEAD');
      const result = { path: new URL(url).pathname, status: response.status, contentType: response.headers.get('content-type'), ok: response.status === 200 && /image\//i.test(response.headers.get('content-type') ?? '') };
      if (!result.ok) log(JSON.stringify({ image: result.path, status: result.status, contentType: result.contentType }));
      return result;
    } catch { return { path: new URL(url).pathname, status: null, ok: false }; }
    finally { if (++imagesCompleted % 50 === 0) log(`Images checked: ${imagesCompleted}/${localImages.length}`); }
  });
  const issueCounts = {};
  for (const result of results) for (const issue of result.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  const summary = { sitemapCount: sitemaps.length, urlCount: urls.length, expectedCount, countMatches: urls.length === expectedCount, pages200: results.filter(result => result.status === 200).length, pagesWithIssues: results.filter(result => result.issues.length).length, uniqueLocalImages: images.length, imageFailures: images.filter(image => !image.ok).length, externalImagesNotRequested: new Set(results.flatMap(result => result.imageSources).filter(url => new URL(url).origin !== ORIGIN)).size, issueCounts };
  const report = { origin: ORIGIN, startedAt, finishedAt: new Date().toISOString(), concurrency: 4, summary, sitemaps: sitemaps.map(map => ({ path: map.path, count: map.urls.length })), pages: results.map(({ imageSources, ...result }) => result), images };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const problemRows = results.filter(result => result.issues.length).slice(0, 80).map(result => `| ${result.path.replaceAll('|', '%7C')} | ${result.status ?? 'error'} | ${result.issues.join(', ')} |`).join('\n');
  const imageRows = images.filter(image => !image.ok).slice(0, 40).map(image => `- ${image.path}: ${image.status ?? 'error'}`).join('\n');
  writeFileSync(reportPath.replace(/\.json$/, '.md'), `# Auditoría HTTP del desarrollo\n\nOrigen: ${ORIGIN}. Inicio: ${startedAt}. Final: ${report.finishedAt}. Concurrencia: 4.\n\nSe consultaron ${urls.length} rutas de ${sitemaps.length} sitemaps (${expectedCount} esperadas). ${summary.pages200} respondieron 200; ${summary.pagesWithIssues} presentan observaciones. Se comprobaron ${images.length} imágenes locales únicas mediante HEAD; ${summary.imageFailures} fallaron. No se solicitaron las ${summary.externalImagesNotRequested} imágenes externas únicas.\n\nComprobaciones: estado HTTP, protección noindex/no-store del desarrollo, una etiqueta title y una canónica absoluta, ruta canónica, JSON-LD válido, Course en fichas, ausencia de artículo en fichas y de WebSite duplicado, y fuentes de imágenes. Los cambios intencionales de canónica requieren revisión; una observación no demuestra un fallo de indexación. No se ejecutó JavaScript ni se accedió a sesiones privadas de EmDash.\n\n## Observaciones de páginas\n\n${problemRows ? '| Ruta | Estado | Observaciones |\n| --- | --- | --- |\n' + problemRows : 'Sin observaciones en las comprobaciones realizadas.'}\n\n## Imágenes locales\n\n${imageRows || 'Todas las imágenes locales consultadas respondieron 200 con Content-Type de imagen.'}\n\nDetalle completo en el JSON homónimo. No contiene credenciales ni cuerpos HTML.\n`);
  log(JSON.stringify(summary));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.deepEqual(args, ['--execute'], 'Run explicitly with --execute after the final development deployment');
  runAudit().catch(error => { console.error(error instanceof Error ? error.message : 'Audit failed'); process.exitCode = 1; });
}
