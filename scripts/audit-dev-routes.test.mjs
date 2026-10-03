import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectHTML, parallelMap, sitemapLocations, targetURL } from './audit-dev-routes.mjs';

test('sitemap targets normalize to development and reject foreign or credential-bearing origins', () => {
  assert.equal(targetURL('https://sably.co/co/'), 'https://dev.sably.co/co/');
  for (const value of ['https://attacker.test/co/', 'https://name:secret@dev.sably.co/co/', 'http://dev.sably.co/co/']) assert.throws(() => targetURL(value));
  assert.deepEqual(sitemapLocations('<url><loc>https://sably.co/a/?a=1&amp;b=2</loc></url>'), ['https://sably.co/a/?a=1&b=2']);
});

test('HTML parser checks reordered attributes, canonical, JSON-LD and missing image sources', () => {
  const html = `<html><head><title>Curso</title><link href='https://dev.sably.co/co/curso-a/' rel='canonical'><script type='application/ld+json'>{"@type":["Product","Course"]}</script></head><body><img alt='Valid' src='/_emdash/api/media/file/key.webp'><img alt='Broken'><img src='[object Object]'></body></html>`;
  const result = inspectHTML(html, 'https://dev.sably.co/co/curso-a/');
  assert.equal(result.imageCount, 3);
  assert.deepEqual(result.issues, ['image-without-source', 'invalid-image-source']);
  assert.deepEqual(result.schemaTypes, ['Product', 'Course']);
  assert.deepEqual(result.imageSources, ['https://dev.sably.co/_emdash/api/media/file/key.webp']);
});

test('detects malformed JSON-LD, duplicate website nodes and incorrect article markup on a course', () => {
  const result = inspectHTML(`<title>A</title><link rel=canonical href='https://dev.sably.co/other/'><script type='application/ld+json'>{bad}</script><script type='application/ld+json'>{"@graph":[{"@type":"WebSite"},{"@type":"WebSite"},{"@type":"Article"}]}</script>`, 'https://dev.sably.co/co/curso-a/');
  for (const issue of ['invalid-jsonld', 'canonical-path-differs', 'duplicate-website-schema', 'course-schema-missing', 'article-schema-on-course']) assert.ok(result.issues.includes(issue));
});
test('reports simultaneous Article and BlogPosting for the same document', () => {
  const result = inspectHTML(`<title>Artículo</title><link rel=canonical href='https://dev.sably.co/blog/a/'><script type='application/ld+json'>{"@type":"Article"}</script><script type='application/ld+json'>{"@type":"BlogPosting"}</script>`, 'https://dev.sably.co/blog/a/');
  assert.deepEqual(result.issues, ['duplicate-article-schema']);
});

test('worker pool preserves results while enforcing four in-flight requests', async () => {
  let active = 0, max = 0;
  const results = await parallelMap(Array.from({ length: 13 }, (_, i) => i), async value => {
    active++; max = Math.max(max, active); await new Promise(resolve => setImmediate(resolve)); active--; return value * 2;
  });
  assert.equal(max, 4);
  assert.deepEqual(results, Array.from({ length: 13 }, (_, i) => i * 2));
});
