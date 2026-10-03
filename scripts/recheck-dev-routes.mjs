#!/usr/bin/env node
/** Recheck only the concrete issues captured by the complete development crawl. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ORIGIN, inspectHTML, parallelMap, targetURL } from './audit-dev-routes.mjs';

export function pathsToRecheck(report) {
  return report.pages.filter(page => page.issues.length || (page.schemaTypes?.includes('Article') && page.schemaTypes?.includes('BlogPosting'))).map(page => page.path);
}
export async function recheck() {
  const baseline = JSON.parse(readFileSync('docs/dev-route-audit.json', 'utf8'));
  assert.equal(baseline.origin, ORIGIN);
  const paths = pathsToRecheck(baseline);
  assert.ok(paths.length > 0 && paths.length < 200, 'Unexpected scope for targeted recheck');
  const local = existsSync('.dev.vars') ? parseEnv(readFileSync('.dev.vars', 'utf8')) : {};
  const password = process.env.SABLY_DEV_PASSWORD || local.SABLY_DEV_PASSWORD;
  assert.ok(password, 'Missing preview access');
  const results = await parallelMap(paths, async path => {
    const url = targetURL(path);
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': 'SablyMigrationRouteRecheck/1.0', 'X-Sably-Preview-Token': password } });
      const body = await response.text();
      const html = inspectHTML(body, url);
      if (response.status !== 200) html.issues.push(`http:${response.status}`);
      if (!/noindex/i.test(response.headers.get('x-robots-tag') ?? '')) html.issues.push('development-noindex-header-missing');
      if (!/no-store/i.test(response.headers.get('cache-control') ?? '')) html.issues.push('development-no-store-missing');
      if (path.startsWith('/blog/')) {
        if (html.articleDetails.length !== 1) html.issues.push('article-count-not-one');
        for (const article of html.articleDetails) {
          if (!article.authorId?.endsWith('/#organization') || !article.publisherId?.endsWith('/#organization')) html.issues.push('article-organization-reference-missing');
          if (!['hasPublishedTime', 'hasModifiedTime', 'hasLanguage', 'hasWordCount', 'hasReadingTime', 'hasKeywords', 'hasBlogReference'].every(key => article[key])) html.issues.push('article-fields-lost');
        }
      }
      const { imageSources, ...checks } = html;
      const result = { path, status: response.status, ...checks };
      console.log(JSON.stringify({ path, status: result.status, issues: result.issues }));
      return result;
    } catch (error) { return { path, status: null, issues: ['request-failed'], error: error instanceof Error ? error.name : 'Error' }; }
  });
  const report = { checkedAt: new Date().toISOString(), origin: ORIGIN, baselineFinishedAt: baseline.finishedAt, concurrency: 4, checked: results.length, passed: results.filter(row => row.status === 200 && row.issues.length === 0).length, results };
  writeFileSync('docs/dev-route-recheck.json', JSON.stringify(report, null, 2) + '\n');
  writeFileSync('docs/dev-route-recheck.md', `# Verificación de correcciones HTTP\n\nFecha: ${report.checkedAt}. Origen: ${ORIGIN}. Se volvieron a consultar ${report.checked} rutas con observaciones del barrido completo terminado el ${baseline.finishedAt}; ${report.passed} superaron todas las comprobaciones.\n\nIncluye las ocho portadas de país y los diez artículos. Se comprueba una única representación Article/BlogPosting por artículo, fechas, idioma, palabras, tiempo de lectura, palabras clave, referencia al blog y autor/editor Organization. Conserva las pruebas de título, canónica, JSON-LD válido, fuentes de imágenes y protección de desarrollo.\n\n| Ruta | Estado | Observaciones |\n| --- | --- | --- |\n${results.map(row => `| ${row.path} | ${row.status ?? 'error'} | ${row.issues.join(', ') || 'Sin observaciones'} |`).join('\n')}\n\nEl barrido completo previo verificó ${baseline.summary.pages200}/${baseline.summary.urlCount} páginas HTTP200 y ${baseline.summary.uniqueLocalImages} imágenes locales. Esta verificación acotada no vuelve a rastrear las rutas sin cambios ni todas las imágenes.\n`);
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--execute'], 'Run only with --execute after the corrective deployment');
  recheck().then(report => { if (report.passed !== report.checked) process.exitCode = 1; }).catch(error => { console.error(error instanceof Error ? error.message : 'Recheck failed'); process.exitCode = 1; });
}
