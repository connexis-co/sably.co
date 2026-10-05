/**
 * Anonymous page copies for visitors whose request carries analytics cookies,
 * reload headers or ad click IDs (see `sharedPublicRequest`). Workers Cache
 * keys on the URL and `Vary: Cookie`, so each of those visitors would render
 * the whole page. They are answered from the Worker's own Cache API instead,
 * the pattern Sovialis uses. The previous `ctx.exports` loopback through
 * Workers Cache stalled ~20 s when the entry was stale (measured 2026-10-04).
 *
 * Copies are per Worker version and refresh in the background after ten
 * minutes; editorial purges only reach Workers Cache, so this bounds how long
 * a cookie-bearing visitor can see a page from before an edit.
 */
export const SHARED_FRESH_SECONDS = 600;
export const SHARED_KEEP_SECONDS = 604_800;
const STORED_AT = 'x-sably-stored-at';

export interface SharedCacheDeps {
  cache: Pick<Cache, 'match' | 'put'>;
  /** Anonymous render, already passed through the delivery policy. */
  render: (request: Request) => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
}

export function sharedCacheKey(shared: Request, version: string): Request {
  const url = new URL(shared.url);
  return new Request(`${url.origin}${url.pathname}?sably-version=${encodeURIComponent(version || 'unversioned')}`);
}

/** Only what the delivery policy would itself share at the edge for an anonymous visitor. */
function storable(response: Response): boolean {
  return response.status === 200 && !response.headers.has('set-cookie')
    && /text\/html/i.test(response.headers.get('content-type') ?? '')
    && /^public\b/i.test(response.headers.get('cloudflare-cdn-cache-control') ?? '');
}

async function renderAndStore(shared: Request, key: Request, deps: SharedCacheDeps): Promise<Response> {
  const response = await deps.render(shared);
  if (storable(response)) {
    const copy = response.clone();
    const headers = new Headers(copy.headers);
    for (const name of ['cloudflare-cdn-cache-control', 'cache-tag', 'vary', 'set-cookie']) headers.delete(name);
    headers.set('Cache-Control', `public, max-age=${SHARED_KEEP_SECONDS}`);
    headers.set(STORED_AT, String((deps.now ?? Date.now)()));
    deps.waitUntil(deps.cache.put(key, new Response(copy.body, { status: 200, headers })));
  }
  return response;
}

export async function serveSharedPage(shared: Request, key: Request, deps: SharedCacheDeps): Promise<Response> {
  const hit = await deps.cache.match(key);
  if (!hit) {
    const rendered = await renderAndStore(shared, key, deps);
    const headers = new Headers(rendered.headers);
    headers.set('x-sably-cache', 'MISS');
    return new Response(rendered.body, { status: rendered.status, statusText: rendered.statusText, headers });
  }
  const storedAt = Number(hit.headers.get(STORED_AT) ?? 0);
  const stale = !(storedAt > 0) || (deps.now ?? Date.now)() - storedAt > SHARED_FRESH_SECONDS * 1000;
  // Served at once; one background render refreshes it for the next visitor.
  // The render's own body is a clone() branch: cancelling it waits for the stored branch, so don't await it.
  if (stale) deps.waitUntil(renderAndStore(shared, key, deps).then(r => { void r.body?.cancel().catch(() => undefined); }).catch(() => undefined));
  const headers = new Headers(hit.headers);
  headers.delete(STORED_AT);
  headers.set('x-sably-cache', stale ? 'STALE' : 'HIT');
  return new Response(hit.body, { status: hit.status, headers });
}
