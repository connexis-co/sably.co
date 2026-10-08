import assert from 'node:assert/strict';

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}

/** Fail a release when a preferred URL is redirected, blocked or canonicalised elsewhere. */
export function verifyIndexableHtml(url, status, headers, html, expectedCanonical = url) {
  assert.equal(status, 200, `Preferred URL must answer 200: ${url}`);
  assert(!/\b(noindex|none)\b/i.test(headers.get('x-robots-tag') ?? ''), `noindex header: ${url}`);
  const document = html.replace(/<!--[\s\S]*?-->/g, '');
  const meta = [...document.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  assert(!meta.some(m => /^(robots|googlebot)$/i.test(m.name ?? '') && /\b(noindex|none)\b/i.test(m.content ?? '')), `noindex meta: ${url}`);
  const canonicals = [...document.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0])).filter(m => m.rel?.toLowerCase() === 'canonical');
  assert.equal(canonicals.length, 1, `Expected one canonical: ${url}`);
  assert.equal(canonicals[0].href, expectedCanonical, `Different canonical: ${url}`);
  assert.equal([...document.matchAll(/<h1\b/gi)].length, 1, `Expected one H1: ${url}`);
  assert.match(document, /<title\b[^>]*>[^<]+<\/title>/i, `Missing title: ${url}`);
  const schemas = [...document.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => JSON.parse(m[1]));
  return { url, canonical: expectedCanonical, schemas: schemas.length };
}
