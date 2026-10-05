import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL as NodeURL } from 'node:url';
import test from 'node:test';
import { parseLegacyRedirects, publicCanonicalRedirect, resolveLegacyRedirect,productionOriginRedirect, rootCountryRedirect } from '../src/lib/legacy-redirects.ts';

const source = await readFile(new NodeURL('../public/_redirects', import.meta.url), 'utf8');
const rules = parseLegacyRedirects(source);
const request = (path: string) => new Request(`https://dev.sably.co${path}`);

test('preserves national and city redirects that now match Astro SSR routes', () => {
  for (const [from, to] of [
    ['/co/curso-de-panaderia-artesanal-y-masa-madre/', '/co/curso-de-panaderia/'],
    ['/mx/cdmx/curso-de-panaderia-artesanal-y-masa-madre/', '/mx/cdmx/curso-de-panaderia/'],
    ['/pe/curso/curso-de-barberia/', '/pe/curso-de-barberia/'],
    ['/co/bogota/curso/curso-de-barberia/', '/co/bogota/curso-de-barberia/'],
  ]) {
    const response = resolveLegacyRedirect(request(from!), rules);
    assert.equal(response?.status, 301, from);
    assert.equal(response?.headers.get('location'), `https://dev.sably.co${to}`);
  }
});

test('keeps campaign query parameters byte-for-byte through the redirect', () => {
  const query = '?utm_source=test%20source&gclid=a%2Bb&tag=uno&tag=dos';
  const response = resolveLegacyRedirect(request(`/co/curso/curso-de-barberia/${query}`), rules);
  assert.equal(response?.headers.get('location'), `https://dev.sably.co/co/curso-de-barberia/${query}`);
});

test('specific legacy courses precede the wildcard and remaining paths use its fallback', () => {
  for (const [from, to] of [
    ['/cursos/curso-de-maquillaje-profesional', '/co/curso-de-maquillaje/'],
    ['/cursos/curso-de-peluqueria-profesional/', '/co/curso-de-peluqueria/'],
    ['/cursos/curso-de-manicure-y-pedicure', '/co/curso-de-manicure-y-pedicure/'],
    ['/cursos/curso-de-manicure-y-pedicure/', '/co/curso-de-manicure-y-pedicure/'],
    ['/cursos/curso-de-unas-acrilicas', '/co/curso-de-unas-acrilicas/'],
    ['/cursos/curso-de-unas-semipermanentes', '/co/curso-de-unas/'],
    ['/cursos/curso-de-peinados/', '/co/curso-de-peinados/'],
    ['/cursos/otra-categoria/otro-curso/', '/co/'],
    ['/legal/cookies', '/legal/privacidad/'],
    ['/index.html', '/co/'],
  ]) {
    assert.equal(resolveLegacyRedirect(request(from!), rules)?.headers.get('location'), `https://dev.sably.co${to}`);
  }
});

test('production origin normalizes HTTPS, hostname and legacy destinations without touching staging or write requests',()=>{
 for(const [from,to] of [
  ['http://sably.co/legal/terminos','https://sably.co/legal/terminos/'],
  ['http://www.sably.co/cursos/curso-de-unas-semipermanentes?utm_source=gsc','https://sably.co/co/curso-de-unas/?utm_source=gsc'],
  ['https://www.sably.co/?promo=test','https://sably.co/co/?promo=test'],
 ])assert.equal(productionOriginRedirect(new Request(from!),'production',rules)?.headers.get('location'),to);
 assert.equal(productionOriginRedirect(new Request('http://dev.sably.co/'),'development',rules),null);
 assert.equal(productionOriginRedirect(new Request('https://sably.co/co/'),'production',rules),null);
 assert.equal(productionOriginRedirect(new Request('http://sably.co/api/webhook',{method:'POST'}),'production',rules),null);
});

test('unmatched URLs and the Astro-owned root are left untouched', () => {
  for (const path of ['/', '/co/curso-de-barberia/', '/api/v1/leads/', '/_emdash/admin/', '/co/curso/extra/segments/']) {
    assert.equal(resolveLegacyRedirect(request(path), rules), null, path);
  }
});

test('escapes literal regular-expression characters and limits named captures to one segment', () => {
  const parsed = parseLegacyRedirects('/old.v1/(guide)+/:name/ /new/:name/ 302');
  assert.equal(resolveLegacyRedirect(request('/old.v1/(guide)+/intro/'), parsed)?.status, 302);
  assert.equal(resolveLegacyRedirect(request('/oldXv1/guide/intro/'), parsed), null);
  assert.equal(resolveLegacyRedirect(request('/old.v1/(guide)+/intro/extra/'), parsed), null);
});

test('supports a splat substitution and keeps destination query parameters', () => {
  const parsed = parseLegacyRedirects('/old/* /new/:splat?migration=1 302');
  const response = resolveLegacyRedirect(request('/old/chapter/page?utm_source=preview'), parsed);
  assert.equal(response?.headers.get('location'), 'https://dev.sably.co/new/chapter/page?migration=1&utm_source=preview');
});

test('rejects external destinations, unsupported statuses and broken placeholders at startup', () => {
  for (const line of [
    '/old https://example.invalid/new 301', '/old //example.invalid/new 302',
    '/old /\\example.invalid/new 301', '/old /new 200', '/old /new 308',
    '/old /:missing 301', '/:name/:name/ /new/ 301', '/old/*/* /new/ 301',
  ]) assert.throws(() => parseLegacyRedirects(line), /Invalid legacy redirect/, line);
});

test('encoded slashes stay on the same origin without decoding captures', () => {
  const response = resolveLegacyRedirect(request('/co/curso/%2F%2Fexample.invalid/'), rules);
  assert.equal(response?.headers.get('location'), 'https://dev.sably.co/co/%2F%2Fexample.invalid/');
});

test('all existing rules parse and retain their exact source path semantics', () => {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  assert.equal(rules.length, lines.length);
  assert.ok(rules.length > 20);
  for (const line of lines) {
    const [from, to, status] = line.split(/\s+/) as [string, string, string];
    const materialize = (path: string) => path.replaceAll(':country', 'co').replaceAll(':city', 'bogota')
      .replaceAll(':slug', 'curso-de-barberia').replaceAll('*', 'sin-coincidencia');
    const response = resolveLegacyRedirect(request(materialize(from)), rules);
    assert.equal(response?.status, Number(status), line);
    assert.equal(response?.headers.get('location'), `https://dev.sably.co${materialize(to)}`, line);
  }
});

test('canonicalizes only GET and HEAD public document URLs, preserving the query', () => {
  for (const method of ['GET', 'HEAD']) {
    const response = publicCanonicalRedirect(new Request('https://dev.sably.co/co/curso-de-barberia?utm_source=a%20b', { method }));
    assert.equal(response?.status, 301);
    assert.equal(response?.headers.get('location'), 'https://dev.sably.co/co/curso-de-barberia/?utm_source=a%20b');
  }
});

test('never canonicalizes EmDash, legacy APIs, assets, bootstrap or Astro internals', () => {
  for (const path of [
    '/_emdash', '/_emdash/api/setup', '/api', '/api/v1/leads', '/_astro', '/_astro/file',
    '/internal', '/internal/seed-pilot', '/_server-islands/widget', '/_image',
    '/favicon.svg', '/robots.txt', '/sitemaps/cursos-co.xml',
  ]) assert.equal(publicCanonicalRedirect(request(path)), null, path);
});

test('leaves the root, canonical documents and non-read methods unchanged', () => {
  for (const path of ['/', '/co/', '/co/curso-de-barberia/']) {
    assert.equal(publicCanonicalRedirect(request(path)), null, path);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(publicCanonicalRedirect(new Request('https://dev.sably.co/contacto', { method })), null, method);
  }
});

test('the root goes to the default country before EmDash boots, keeping campaign parameters', () => {
  assert.equal(rootCountryRedirect(request('/'))?.headers.get('location'), 'https://dev.sably.co/co/');
  assert.equal(rootCountryRedirect(request('/?utm_source=x&gclid=1'))?.headers.get('location'), 'https://dev.sably.co/co/?utm_source=x&gclid=1');
  assert.equal(rootCountryRedirect(request('/'))?.status, 301);
  assert.equal(rootCountryRedirect(new Request('https://sably.co/', { method: 'HEAD' }))?.status, 301);
  for (const path of ['/co/', '/x', '//']) assert.equal(rootCountryRedirect(request(path)), null, path);
  assert.equal(rootCountryRedirect(new Request('https://sably.co/', { method: 'POST' })), null);
});
