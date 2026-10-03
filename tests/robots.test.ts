import test from 'node:test';
import assert from 'node:assert/strict';
import { robotsContent } from '../src/lib/robots';
test('development and an unknown environment always block crawling despite production settings', () => {
  for (const environment of ['development', undefined, 'prod']) {
    assert.equal(robotsContent(environment, 'User-agent: *\nAllow: /'), 'User-agent: *\nDisallow: /\n');
  }
});
test('production defaults allow native media and advertise the complete Sably sitemap', () => {
  const result = robotsContent('production');
  assert.match(result, /Allow: \/_emdash\/api\/media\/file\//);
  assert.match(result, /Disallow: \/_emdash\//);
  assert.match(result, /Sitemap: https:\/\/sably.co\/sitemap-index.xml/);
});
test('production respects editorial robots content without duplicating its sitemap', () => {
  const custom = 'User-agent: *\nDisallow: /privado/\nSitemap: https://sably.co/sitemap-index.xml';
  assert.equal(robotsContent('production', custom), `${custom}\n`);
});
