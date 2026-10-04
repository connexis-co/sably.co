import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCachePublicPage, changesPublicPlugin, protectDeliveryResponse } from '../src/lib/public-delivery';

const request = (path = '/co/', headers: Record<string, string> = {}) => new Request('https://sably.co' + path, { headers });
const page = (extra: Record<string, string> = {}, status = 200) => new Response('<main>Published content</main>', {
  status, headers: { 'content-type': 'text/html', 'Cloudflare-CDN-Cache-Control': 'public, max-age=60', ...extra },
});

test('anonymous HTML has separate cache variants from credentials, previews and revalidation requests', async () => {
  const publicResponse = protectDeliveryResponse(request(), page(), 'production');
  assert.equal(publicResponse.headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=60');
  assert.equal(publicResponse.headers.get('Cache-Control'), 'max-age=0, must-revalidate');
  for (const name of ['Cookie', 'Authorization', 'X-Sably-Preview-Token', 'Range', 'Cache-Control', 'Pragma']) {
    assert.ok(publicResponse.headers.get('Vary')!.split(', ').includes(name));
    const privateResponse = protectDeliveryResponse(request('/co/', { [name]: name === 'Cache-Control' ? 'no-cache' : 'test' }), page(), 'production');
    assert.equal(privateResponse.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store', name);
  }
  assert.equal(await publicResponse.text(), '<main>Published content</main>');
  // Astro gives the browser no-cache when EmDash adds Last-Modified hints;
  // its explicit CDN TTL remains independently cacheable.
  assert.equal(protectDeliveryResponse(request(), page({ 'cache-control': 'no-cache' }), 'production').headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=60');
  assert.equal(protectDeliveryResponse(request(), page({ 'Cloudflare-CDN-Cache-Control': 'public' }), 'production').headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
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

test('only successful native Sably plugin writes invalidate shared pages', () => {
  const save = new Request('https://sably.co/_emdash/api/plugins/sably-operations/save-promo', { method: 'POST' });
  assert.equal(changesPublicPlugin(save, new Response('ok')), true);
  for (const status of [400, 401, 403, 500]) assert.equal(changesPublicPlugin(save, new Response('error', { status })), false);
  assert.equal(changesPublicPlugin(new Request(save.url), new Response('ok')), false);
  assert.equal(changesPublicPlugin(new Request('https://sably.co/api/v1/leads', { method: 'POST' }), new Response('ok')), false);
});
