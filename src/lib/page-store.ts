import { PUBLIC_PAGE_SWR, PUBLIC_PAGE_TTL } from './public-delivery';

/**
 * Global copy of every anonymous page in Workers KV.
 *
 * Workers Cache lives per data center, and with ~1.000 pages and little
 * traffic most first visits in a colo found nothing. When an entry expired,
 * the first visitor waited for the full EmDash render (`EXPIRED`, 3–8 s,
 * measured 2026-10-05) instead of getting the stale copy. Here a miss in
 * Workers Cache reads the page from KV, which every colo shares, and a stale
 * copy is answered at once while one background render replaces it.
 *
 * Keys carry the Worker version (older HTML points at `/_astro/` files the new
 * version no longer ships) and a generation that every editorial or Sably
 * write bumps, so invalidation never needs to list or delete keys.
 */
export const PAGE_GENERATION_KEY = 'sably:page-generation';
const PAGE_PREFIX = 'sably:page:';
/** Edge TTL while a stale copy is being replaced in the background. */
export const STALE_EDGE_TTL = 60;
const NOT_STORED = new Set(['set-cookie', 'date', 'age', 'content-length', 'content-encoding', 'server-timing',
  'cf-cache-status', 'x-sably-store', 'x-sably-cache']);

interface StoredPage {
  storedAt: number;
  /** Edge freshness the render declared, already bounded by the next promotion. */
  maxAge: number;
  headers: [string, string][];
  body: string;
}

export interface PageStoreDeps {
  kv: Pick<KVNamespace, 'get' | 'put'>;
  version: string;
  /** Anonymous render, already passed through the delivery policy. */
  render: (request: Request) => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
}

export async function pageGeneration(kv: Pick<KVNamespace, 'get'>): Promise<string> {
  try {
    // Edits reach every colo within this read's cache window.
    return (await kv.get(PAGE_GENERATION_KEY, { cacheTtl: 30 })) ?? '0';
  } catch {
    return '0';
  }
}

export async function bumpPageGeneration(kv: Pick<KVNamespace, 'put'>, now = Date.now()): Promise<void> {
  await kv.put(PAGE_GENERATION_KEY, String(now));
}

export function pageStoreKey(anonymous: Request, version: string, generation: string): string {
  return `${PAGE_PREFIX}${version || 'unversioned'}:${generation}:${new URL(anonymous.url).pathname}`;
}

const edgeMaxAge = (policy: string) => Number(policy.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 0);

/** Only what the delivery policy itself would share at the edge for an anonymous visitor. */
function storable(response: Response): boolean {
  return response.status === 200 && !response.headers.has('set-cookie')
    && /text\/html/i.test(response.headers.get('content-type') ?? '')
    && /^public\b/i.test(response.headers.get('cloudflare-cdn-cache-control') ?? '')
    && edgeMaxAge(response.headers.get('cloudflare-cdn-cache-control') ?? '') > 0;
}

async function renderAndStore(anonymous: Request, key: string, deps: PageStoreDeps): Promise<Response> {
  const response = await deps.render(anonymous);
  if (!storable(response)) return response;
  const now = (deps.now ?? Date.now)();
  const copy = response.clone();
  const headers = [...copy.headers].filter(([name]) => !NOT_STORED.has(name.toLowerCase()));
  const maxAge = edgeMaxAge(copy.headers.get('cloudflare-cdn-cache-control') ?? '');
  deps.waitUntil(copy.text()
    .then(body => deps.kv.put(key, JSON.stringify({ storedAt: now, maxAge, headers, body } satisfies StoredPage),
      { expirationTtl: PUBLIC_PAGE_TTL + PUBLIC_PAGE_SWR }))
    .catch(() => console.error('Page store write failed; the page renders again next time.')));
  return response;
}

function withStoreStatus(response: Response, status: 'MISS' | 'HIT' | 'STALE'): Response {
  const headers = new Headers(response.headers);
  headers.set('x-sably-store', status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function servePage(anonymous: Request, deps: PageStoreDeps): Promise<Response> {
  const key = pageStoreKey(anonymous, deps.version, await pageGeneration(deps.kv));
  let stored: StoredPage | null = null;
  try {
    stored = await deps.kv.get<StoredPage>(key, { type: 'json', cacheTtl: 60 });
  } catch {
    stored = null;
  }
  if (!stored?.body || !Array.isArray(stored.headers)) return withStoreStatus(await renderAndStore(anonymous, key, deps), 'MISS');

  const age = Math.max(0, ((deps.now ?? Date.now)() - stored.storedAt) / 1000);
  const fresh = age < stored.maxAge;
  const headers = new Headers(stored.headers);
  if (fresh) {
    // The edge keeps it only for what is left of the freshness the render declared.
    headers.set('cloudflare-cdn-cache-control', `public, max-age=${Math.max(1, Math.floor(stored.maxAge - age))}, stale-while-revalidate=${PUBLIC_PAGE_SWR}`);
  } else {
    // Answered now; one background render replaces it. The render's own body is a
    // clone() branch: cancelling it waits for the stored branch, so it isn't awaited.
    deps.waitUntil(renderAndStore(anonymous, key, deps)
      .then(r => { void r.body?.cancel().catch(() => undefined); })
      .catch(() => undefined));
    headers.set('cloudflare-cdn-cache-control', `public, max-age=${STALE_EDGE_TTL}`);
  }
  headers.set('x-sably-store', fresh ? 'HIT' : 'STALE');
  return new Response(stored.body, { status: 200, headers });
}
