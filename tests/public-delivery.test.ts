import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rootCountryRedirect } from '../src/lib/legacy-redirects';
import {
  canCachePublicPage, invalidatedTags, pageMaxAge, protectDeliveryResponse, sharedPublicRequest,
  MEDIA_TAG, PUBLIC_DATA_EDGE, PUBLIC_PAGE_TAG,
} from '../src/lib/public-delivery';

const EDGE = 'public, max-age=86400, stale-while-revalidate=604800';
const request = (path = '/co/', headers: Record<string, string> = {}) => new Request('https://sably.co' + path, { headers });
const page = (extra: Record<string, string> = {}, status = 200) => new Response('<main>Published content</main>', {
  status, headers: { 'content-type': 'text/html', 'Cloudflare-CDN-Cache-Control': EDGE, ...extra },
});

test('anonymous HTML has separate cache variants from credentials, previews and revalidation requests', async () => {
  const publicResponse = protectDeliveryResponse(request(), page(), 'production');
  assert.equal(publicResponse.headers.get('Cloudflare-CDN-Cache-Control'), EDGE);
  // must-revalidate would also stop the edge from serving stale while it refreshes.
  assert.equal(publicResponse.headers.get('Cache-Control'), 'max-age=0');
  const vary = publicResponse.headers.get('Vary')!.split(', ');
  for (const name of ['Authorization', 'X-Sably-Preview-Token', 'Range']) assert.ok(vary.includes(name), name);
  // Stored entries are always anonymous renders: cookies and reloads share them.
  for (const name of ['Cookie', 'Cache-Control', 'Pragma']) assert.ok(!vary.includes(name), name);
  for (const name of ['Cookie', 'Authorization', 'X-Sably-Preview-Token', 'Range', 'Cache-Control', 'Pragma']) {
    const privateResponse = protectDeliveryResponse(request('/co/', { [name]: name === 'Cache-Control' ? 'no-cache' : 'test' }), page(), 'production');
    assert.equal(privateResponse.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store', name);
  }
  assert.equal(await publicResponse.text(), '<main>Published content</main>');
  // Astro gives the browser no-cache when EmDash adds Last-Modified hints;
  // its explicit CDN TTL remains independently cacheable.
  assert.equal(protectDeliveryResponse(request(), page({ 'cache-control': 'no-cache' }), 'production').headers.get('Cloudflare-CDN-Cache-Control'), EDGE);
  for (const edge of ['public', 'public, max-age=86401', 'public, max-age=86400, stale-while-revalidate=604801']) {
    assert.equal(protectDeliveryResponse(request(), page({ 'Cloudflare-CDN-Cache-Control': edge }), 'production').headers.get('Cloudflare-CDN-Cache-Control'), 'no-store', edge);
  }
});

test('drafts, campaigns, errors, private responses and development never populate the page cache', () => {
  for (const path of ['/co/?promo=navidad', '/blog/a/?_preview=token', '/_preview-promos/', '/api/v1/leads/', '/admin/', '/_emdash/admin/', '/co/curso%2Fprivado/']) {
    assert.equal(canCachePublicPage(request(path), 'production'), false, path);
    assert.equal(protectDeliveryResponse(request(path), page(), 'production').headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  }
  for (const response of [page({}, 404), page({}, 503), page({ 'set-cookie': 'session=private' }), page({ 'cache-control': 'private, no-store' }), page({ vary: '*' })]) {
    assert.equal(protectDeliveryResponse(request(), response, 'production').headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  }
  assert.equal(canCachePublicPage(new Request('https://dev.sably.co/co/'), 'production'), false);
  assert.equal(canCachePublicPage(request(), 'development'), false);
  assert.equal(canCachePublicPage(new Request('https://sably.co/co/', { method: 'POST' }), 'production'), false);
});

test('analytics cookies, reloads and ad click IDs resolve to the anonymous cached page', () => {
  const cases: [string, Record<string, string>][] = [
    ['/co/', { cookie: '_ga=GA1.1.1.2; _ga_RZF4MSX5B7=GS2.1; _clck=x; _fbp=fb.1' }],
    ['/co/curso-de-unas-acrilicas/?gclid=abc&utm_source=google&utm_campaign=x', {}],
    ['/mx/?fbclid=1&_gl=1*abc', { 'cache-control': 'max-age=0' }],
    ['/blog/a/', { pragma: 'no-cache', 'cache-control': 'no-cache' }],
  ];
  for (const [path, headers] of cases) {
    const shared = sharedPublicRequest(request(path, { ...headers, accept: 'text/html', 'user-agent': 'test' }), 'production');
    assert.ok(shared, path);
    assert.equal(shared.url, 'https://sably.co' + path.replace(/\?.*$/, ''));
    for (const name of ['cookie', 'cache-control', 'pragma']) assert.equal(shared.headers.has(name), false);
    assert.equal(shared.headers.get('accept'), 'text/html');
    assert.equal(canCachePublicPage(shared, 'production'), true);
    // The anonymous request is already canonical: no second loopback.
    assert.equal(sharedPublicRequest(shared, 'production'), null);
  }
});

test('editors, previews, campaigns and private paths keep their personal render', () => {
  const cases: [string, Record<string, string>][] = [
    ['/co/', {}],
    ['/co/', { cookie: '_ga=1; astro-session=abc' }],
    ['/co/', { cookie: 'emdash-edit-mode=true' }],
    ['/co/', { cookie: 'CF_Authorization=jwt' }],
    ['/co/', { authorization: 'Bearer x', cookie: '_ga=1' }],
    ['/co/', { 'x-sably-preview-token': 't', cookie: '_ga=1' }],
    ['/co/?promo=ads50&utm_source=meta', {}],
    ['/blog/a/?_preview=token&gclid=1', {}],
    ['/co/?page=2', { cookie: '_ga=1' }],
    ['/api/v1/promo', { cookie: '_ga=1' }],
    ['/_emdash/admin/', { cookie: '_ga=1' }],
    ['/co', { cookie: '_ga=1' }],
  ];
  for (const [path, headers] of cases) assert.equal(sharedPublicRequest(request(path, headers), 'production'), null, `${path} ${JSON.stringify(headers)}`);
  assert.equal(sharedPublicRequest(request('/co/', { cookie: '_ga=1' }), 'development'), null);
  assert.equal(sharedPublicRequest(new Request('https://sably.co/co/', { method: 'POST', headers: { cookie: '_ga=1' } }), 'production'), null);
});

test('ChatGPT referrals retain attribution through the country redirect and anonymous cache', () => {
  const query = '?utm_source=chatgpt.com&utm_medium=referral';
  const incoming = request('/' + query);
  const redirect = rootCountryRedirect(incoming);
  assert.equal(redirect?.status, 301);
  assert.equal(redirect?.headers.get('location'), 'https://sably.co/co/' + query);
  const visitor = new Request(redirect!.headers.get('location')!);
  const shared = sharedPublicRequest(visitor, 'production');
  assert.equal(shared?.url, 'https://sably.co/co/');
  assert.equal(visitor.url, 'https://sably.co/co/' + query);
  assert.equal(incoming.url, 'https://sably.co/' + query);
});

test('the loopback answer reaches the visitor without being stored under their key', () => {
  const response = protectDeliveryResponse(request('/co/?gclid=1', { cookie: '_ga=1' }), page(), 'production', { shared: true });
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Cache-Control'), 'max-age=0');
  const missing = protectDeliveryResponse(request('/co/x/?gclid=1'), page({}, 404), 'production', { shared: true });
  assert.equal(missing.headers.get('Cache-Control'), 'private, no-store');
});

test('media originals stay at the edge until a media write purges them', () => {
  const file = (type = 'image/webp', extra: Record<string, string> = {}) => new Response('bytes', {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=0, must-revalidate', ...extra },
  });
  const path = '/_emdash/api/media/file/migration/abc.webp';
  const cached = protectDeliveryResponse(request(path, { cookie: '_ga=1' }), file(), 'production');
  assert.equal(cached.headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=2592000');
  assert.equal(cached.headers.get('Cache-Tag'), MEDIA_TAG);
  assert.equal(cached.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
  for (const [p, response, env] of [
    [path, file('application/pdf'), 'production'],
    [path, file('image/webp', { 'set-cookie': 'a=b' }), 'production'],
    [path + '?v=1', file(), 'production'],
    [path, file(), 'development'],
    ['/_emdash/api/media', file(), 'production'],
  ] as const) {
    assert.equal(protectDeliveryResponse(request(p), response, env).headers.get('Cloudflare-CDN-Cache-Control'), 'no-store', `${p} ${env}`);
  }
  const missing = protectDeliveryResponse(request(path), new Response('{}', { status: 404, headers: { 'content-type': 'image/webp' } }), 'production');
  assert.equal(missing.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
});

test('widget config and live promotions share one short edge entry tagged for plugin purges', () => {
  const data = (status = 200, edge = PUBLIC_DATA_EDGE) => new Response('{}', {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30', 'cloudflare-cdn-cache-control': edge },
  });
  for (const path of ['/api/v1/config', '/api/v1/promo']) {
    const response = protectDeliveryResponse(request(path, { cookie: '_ga=1' }), data(), 'production');
    assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), PUBLIC_DATA_EDGE);
    assert.equal(response.headers.get('Cache-Tag'), PUBLIC_PAGE_TAG);
  }
  for (const [path, response] of [
    ['/api/v1/promo', data(503)], ['/api/v1/promo?x=1', data()], ['/api/v1/pulso', data()],
    ['/api/v1/config', data(200, 'public, max-age=3600')],
  ] as const) {
    assert.equal(protectDeliveryResponse(request(path), response, 'production').headers.get('Cloudflare-CDN-Cache-Control'), 'no-store', path);
  }
});

test('only Sably fast-path permanent redirects inside the site are shared', () => {
  const to = (location: string, status = 301) => new Response(null, { status, headers: { location } });
  const shared = protectDeliveryResponse(request('/'), to('https://sably.co/co/'), 'production', { redirect: true });
  assert.equal(shared.headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=86400');
  for (const [response, policy] of [
    [to('https://sably.co/co/'), {}],
    [to('https://sably.co/co/', 302), { redirect: true }],
    [to('https://evil.example/'), { redirect: true }],
  ] as const) {
    assert.equal(protectDeliveryResponse(request('/'), response, 'production', policy).headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  }
  assert.equal(protectDeliveryResponse(request('/'), to('https://sably.co/co/'), 'development', { redirect: true }).headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
});

test('only trusted successful writes invalidate shared pages', () => {
  const save = new Request('https://sably.co/_emdash/api/plugins/sably-operations/save-promo', { method: 'POST' });
  assert.deepEqual(invalidatedTags(save, new Response('ok')), [PUBLIC_PAGE_TAG]);
  for (const status of [400, 401, 403, 500]) assert.deepEqual(invalidatedTags(save, new Response('error', { status })), []);
  assert.deepEqual(invalidatedTags(new Request(save.url), new Response('ok')), []);
  const post = (path: string) => new Request('https://sably.co' + path, { method: 'POST' });
  assert.deepEqual(invalidatedTags(post('/api/v1/precios'), new Response('ok')), [PUBLIC_PAGE_TAG]);
  assert.deepEqual(invalidatedTags(post('/api/v1/subjects'), new Response('ok')), [PUBLIC_PAGE_TAG]);
  assert.deepEqual(invalidatedTags(post('/_emdash/api/media'), new Response('ok')), [MEDIA_TAG, PUBLIC_PAGE_TAG]);
  assert.deepEqual(invalidatedTags(new Request('https://sably.co/_emdash/api/media/01J', { method: 'DELETE' }), new Response('ok')), [MEDIA_TAG, PUBLIC_PAGE_TAG]);
  // Visitor-triggered writes (leads, votes, the rate-limited price refresh) never purge.
  for (const path of ['/api/v1/leads', '/api/v1/votos', '/api/v1/precios/refresca', '/api/v1/comentarios']) {
    assert.deepEqual(invalidatedTags(post(path), new Response('ok')), [], path);
  }
});

test('pages stay fresh a day but never past the next promotion start or end', () => {
  const now = 1_800_000_000;
  assert.equal(pageMaxAge(null, now), 86_400);
  assert.equal(pageMaxAge(now + 3600, now), 3600);
  assert.equal(pageMaxAge(now + 10, now), 60);
  assert.equal(pageMaxAge(now + 30 * 86_400, now), 86_400);
  assert.equal(pageMaxAge(Number.NaN, now), 86_400);
});
