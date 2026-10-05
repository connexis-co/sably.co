import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveSharedPage, sharedCacheKey, SHARED_FRESH_SECONDS } from '../src/lib/shared-page-cache';

class MemoryCache {
  entries = new Map<string, Response>();
  async match(key: RequestInfo | URL) { const hit = this.entries.get(String(key instanceof Request ? key.url : key)); return hit?.clone(); }
  // Like the real Cache API, put() consumes the body.
  async put(key: RequestInfo | URL, response: Response) { const body = await response.arrayBuffer(); this.entries.set(String(key instanceof Request ? key.url : key), new Response(body, { status: response.status, headers: response.headers })); }
}
const page = (body = '<main>Hola</main>', extra: Record<string, string> = {}, status = 200) => new Response(body, { status, headers: {
  'content-type': 'text/html', 'cloudflare-cdn-cache-control': 'public, max-age=86400', 'cache-tag': 'sably:public', vary: 'Cookie', ...extra } });

function harness(render: (r: Request) => Response) {
  const cache = new MemoryCache(); const pending: Promise<unknown>[] = []; let renders = 0; let clock = 1_000_000;
  const deps = { cache, waitUntil: (p: Promise<unknown>) => { pending.push(p); }, now: () => clock,
    render: async (r: Request) => { renders++; return render(r); } };
  return { cache, deps, settle: () => Promise.all(pending.splice(0)), renders: () => renders, tick: (s: number) => { clock += s * 1000; } };
}
const shared = new Request('https://sably.co/co/curso-de-barberia/');

test('keys drop the query and separate Worker versions', () => {
  assert.equal(sharedCacheKey(new Request('https://sably.co/co/?gclid=1'), 'v1').url, 'https://sably.co/co/?sably-version=v1');
  assert.notEqual(sharedCacheKey(shared, 'v1').url, sharedCacheKey(shared, 'v2').url);
});

test('first visitor renders and stores; the next is served without rendering', async () => {
  const h = harness(() => page()); const key = sharedCacheKey(shared, 'v1');
  const first = await serveSharedPage(shared, key, h.deps);
  assert.equal(first.headers.get('x-sably-cache'), 'MISS'); assert.equal(await first.text(), '<main>Hola</main>');
  await h.settle();
  const stored = await h.cache.match(key);
  assert.equal(stored?.headers.get('cache-control'), 'public, max-age=604800');
  for (const name of ['cloudflare-cdn-cache-control', 'cache-tag', 'vary']) assert.equal(stored?.headers.has(name), false, name);
  const second = await serveSharedPage(shared, key, h.deps);
  assert.equal(second.headers.get('x-sably-cache'), 'HIT'); assert.equal(second.headers.has('x-sably-stored-at'), false);
  assert.equal(await second.text(), '<main>Hola</main>'); assert.equal(h.renders(), 1);
});

test('a stale copy is served at once and refreshed in the background', async () => {
  let version = 'antes'; const h = harness(() => page(`<main>${version}</main>`)); const key = sharedCacheKey(shared, 'v1');
  await serveSharedPage(shared, key, h.deps); await h.settle();
  h.tick(SHARED_FRESH_SECONDS + 1); version = 'después';
  const stale = await serveSharedPage(shared, key, h.deps);
  assert.equal(stale.headers.get('x-sably-cache'), 'STALE'); assert.equal(await stale.text(), '<main>antes</main>');
  await h.settle();
  const fresh = await serveSharedPage(shared, key, h.deps);
  assert.equal(fresh.headers.get('x-sably-cache'), 'HIT'); assert.equal(await fresh.text(), '<main>después</main>');
});

test('errors, private and non-shareable renders are never stored', async () => {
  for (const response of [page('x', {}, 404), page('x', { 'set-cookie': 'a=b' }), page('x', { 'cloudflare-cdn-cache-control': 'no-store' }), page('x', { 'content-type': 'application/json' })]) {
    const h = harness(() => response.clone()); const key = sharedCacheKey(shared, 'v1');
    await serveSharedPage(shared, key, h.deps); await h.settle();
    assert.equal(await h.cache.match(key), undefined);
  }
});
