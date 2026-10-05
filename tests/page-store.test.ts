import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bumpPageGeneration, pageGeneration, pageStoreKey, servePage, PAGE_GENERATION_KEY, STALE_EDGE_TTL } from '../src/lib/page-store';

class MemoryKV {
  values = new Map<string, string>(); puts: { key: string; options?: KVNamespacePutOptions }[] = [];
  async get(key: string, options?: { type?: string }) { const v = this.values.get(key); if (v === undefined) return null; return options?.type === 'json' ? JSON.parse(v) : v; }
  async put(key: string, value: string, options?: KVNamespacePutOptions) { this.values.set(key, value); this.puts.push({ key, options }); }
}
const EDGE = 'public, max-age=3600, stale-while-revalidate=604800';
const page = (body = '<main>Hola</main>', extra: Record<string, string> = {}, status = 200) => new Response(body, { status, headers: {
  'content-type': 'text/html', 'cloudflare-cdn-cache-control': EDGE, 'cache-tag': 'sably:public,courses', link: '</f.woff2>; rel=preload',
  'server-timing': 'mw;dur=3000', ...extra } });
function harness(render: () => Response) {
  const kv = new MemoryKV(); const pending: Promise<unknown>[] = []; let renders = 0; let clock = 1_000_000_000;
  const deps = { kv: kv as unknown as KVNamespace, version: 'v1', now: () => clock, waitUntil: (p: Promise<unknown>) => { pending.push(p); },
    render: async () => { renders++; return render(); } };
  const settle = async () => { while (pending.length) await Promise.all(pending.splice(0)); };
  return { kv, deps, settle, renders: () => renders, tick: (s: number) => { clock += s * 1000; } };
}
const anonymous = new Request('https://sably.co/co/curso-de-barberia/');

test('keys carry version, generation and path only', () => {
  assert.equal(pageStoreKey(new Request('https://sably.co/co/?gclid=1'), 'v1', '7'), 'sably:page:v1:7:/co/');
});

test('a miss renders once and every colo then reads the stored copy', async () => {
  const h = harness(() => page());
  const first = await servePage(anonymous, h.deps);
  assert.equal(first.headers.get('x-sably-store'), 'MISS'); assert.equal(await first.text(), '<main>Hola</main>');
  await h.settle();
  const [put] = h.kv.puts; assert.ok(put && put.key.startsWith('sably:page:v1:0:/co/'));
  assert.equal(put.options?.expirationTtl, 86_400 + 604_800);
  h.tick(600);
  const second = await servePage(anonymous, h.deps);
  assert.equal(second.headers.get('x-sably-store'), 'HIT'); assert.equal(await second.text(), '<main>Hola</main>');
  assert.equal(second.headers.get('cloudflare-cdn-cache-control'), 'public, max-age=3000, stale-while-revalidate=604800');
  assert.equal(second.headers.get('cache-tag'), 'sably:public,courses'); assert.equal(second.headers.get('link'), '</f.woff2>; rel=preload');
  assert.equal(second.headers.has('server-timing'), false); assert.equal(h.renders(), 1);
});

test('a stale copy is answered at once and replaced in the background', async () => {
  let text = 'antes'; const h = harness(() => page(`<main>${text}</main>`));
  await servePage(anonymous, h.deps); await h.settle();
  h.tick(3601); text = 'después';
  const stale = await servePage(anonymous, h.deps);
  assert.equal(stale.headers.get('x-sably-store'), 'STALE'); assert.equal(await stale.text(), '<main>antes</main>');
  assert.equal(stale.headers.get('cloudflare-cdn-cache-control'), `public, max-age=${STALE_EDGE_TTL}`);
  await h.settle();
  const fresh = await servePage(anonymous, h.deps);
  assert.equal(fresh.headers.get('x-sably-store'), 'HIT'); assert.equal(await fresh.text(), '<main>después</main>');
});

test('a new generation retires every stored page at once', async () => {
  const h = harness(() => page());
  await servePage(anonymous, h.deps); await h.settle();
  assert.equal(await pageGeneration(h.deps.kv), '0');
  await bumpPageGeneration(h.deps.kv, 42);
  assert.equal(h.kv.values.get(PAGE_GENERATION_KEY), '42');
  const after = await servePage(anonymous, h.deps);
  assert.equal(after.headers.get('x-sably-store'), 'MISS'); assert.equal(h.renders(), 2);
});

test('errors, private and non-shareable renders are never stored', async () => {
  for (const response of [page('x', {}, 404), page('x', { 'set-cookie': 'a=b' }), page('x', { 'cloudflare-cdn-cache-control': 'no-store' }), page('x', { 'content-type': 'application/json' })]) {
    const h = harness(() => response.clone());
    await servePage(anonymous, h.deps); await h.settle();
    assert.equal(h.kv.puts.length, 0);
  }
});

test('KV failures fall back to rendering', async () => {
  const h = harness(() => page());
  const broken = { get: async () => { throw new Error('KV down'); }, put: async () => { throw new Error('KV down'); } } as unknown as KVNamespace;
  const response = await servePage(anonymous, { ...h.deps, kv: broken });
  assert.equal(response.status, 200); assert.equal(await response.text(), '<main>Hola</main>');
  await h.settle();
});
