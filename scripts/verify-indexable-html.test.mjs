import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyIndexableHtml } from './verify-indexable-html.mjs';
const url = 'https://sably.co/co/curso-de-barberia/';
const html = `<head><title>Barbería | Sably</title><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"></head><h1>Barbería</h1><script type="application/ld+json">{"@type":"Product"}</script>`;
test('release verification detects accidental exclusions and conflicting preferred URLs', () => {
  assert.deepEqual(verifyIndexableHtml(url, 200, new Headers(), html), { url, canonical: url, schemas: 1 });
  assert.equal(verifyIndexableHtml('https://sably.co/co/bogota/curso-de-barberia/',200,new Headers(),html,url).canonical,url);
  for (const [status, headers, body] of [
    [301, new Headers(), html],
    [200, new Headers({ 'X-Robots-Tag': 'noindex' }), html],
    [200, new Headers(), html.replace('index,follow', 'noindex,follow')],
    [200, new Headers(), html.replace('name="robots"', 'name="googlebot"').replace('index,follow', 'noindex,follow')],
    [200, new Headers(), html.replace(url, 'https://dev.sably.co/co/curso-de-barberia/')],
    [200, new Headers(), html.replace('</head>', `<link rel="canonical" href="${url}"></head>`)],
    [200, new Headers(), html.replace('<h1>', '<h1>Extra</h1><h1>')],
    [200, new Headers(), html.replace('{"@type":"Product"}', '{broken}')],
  ]) assert.throws(() => verifyIndexableHtml(url, status, headers, body));
});
