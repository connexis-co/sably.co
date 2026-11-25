/**
 * HTML fresh for up to a day at the edge, then served stale for a week while one
 * request refreshes it in the background. Editorial writes purge the native
 * EmDash tags and Sably writes purge `sably:public`, so the window only bounds
 * data changed outside those paths; the layout shortens it to the next
 * promotion start or end (`pageMaxAge`). Low traffic means most colos see a
 * page rarely: a short TTL turned almost every visit into a full render.
 */
export const PUBLIC_PAGE_TTL = 86_400;
export const PUBLIC_PAGE_SWR = 604_800;
export const PUBLIC_PAGE_MIN_TTL = 60;

/** Seconds a page may stay fresh: never past the next promotion boundary. */
export function pageMaxAge(nextBoundary: number | null, now = Math.floor(Date.now() / 1000)): number {
  if (nextBoundary === null || !Number.isFinite(nextBoundary)) return PUBLIC_PAGE_TTL;
  return Math.min(PUBLIC_PAGE_TTL, Math.max(PUBLIC_PAGE_MIN_TTL, Math.ceil(nextBoundary - now)));
}

/**
 * The earliest of the deadlines (epoch seconds) a page must not outlive: the
 * next promotion boundary and, on a course page, the expiry of the Hotmart
 * quote it prints. `freshUntilMs` comes in milliseconds.
 */
export function earliestBoundary(promoBoundary: number | null, freshUntilMs: number | null | undefined): number | null {
  const deadlines = [promoBoundary, typeof freshUntilMs === 'number' ? Math.floor(freshUntilMs / 1000) : null]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return deadlines.length ? Math.min(...deadlines) : null;
}
export const PUBLIC_PAGE_TAG = 'sably:public';
export const PUBLIC_PAGE_TAGS = [PUBLIC_PAGE_TAG, 'emdash:settings',
  'emdash:menu:primary', 'emdash:menu:footer', 'emdash:menu:social', 'emdash:menu:ecosystem',
  'courses', 'course_locales', 'categories', 'countries', 'cities',
  'creators', 'blog', 'pages', 'testimonials', 'homologaciones'];

/** Widget configuration and live promotions read by every page after load. */
export const PUBLIC_DATA_PATHS = new Set(['/api/v1/config', '/api/v1/promo']);
export const PUBLIC_DATA_TTL = 60;
export const PUBLIC_DATA_EDGE = `public, max-age=${PUBLIC_DATA_TTL}, stale-while-revalidate=${PUBLIC_DATA_TTL}`;
export const PUBLIC_DATA_BROWSER = 'public, max-age=30';

/**
 * Outage fallback for the Node origin. It shares a host that runs out of memory
 * and stops answering for hours; with every response marked `no-store`,
 * Cloudflare then answered 52x to everyone, Googlebot's robots.txt included, and
 * an unreachable robots.txt makes Google pause crawling the whole site.
 *
 * Cloudflare keeps the last good copy of what is safe to share and serves it for
 * up to a week only while the origin errors or is unreachable (`stale-if-error`).
 * While the origin is healthy the copy is fresh for at most five minutes: the
 * Node origin cannot purge Cloudflare, so this bounds editorial changes.
 */
export const ORIGIN_EDGE_FRESH = 300;
export const ORIGIN_OUTAGE_STALE = 604_800;
/** Absolute expiry (epoch seconds) of the origin's copy, so a promotion boundary is never crossed at the edge. */
export const FRESH_UNTIL_HEADER = 'X-Sably-Fresh-Until';
/** robots.txt, sitemaps and llms files: what crawlers fetch first and must always get. */
const CRAWL_FILE = /^\/(?:robots\.txt|sitemap\.xml|sitemap-index\.xml|sitemaps\/sitemap-[a-z0-9-]+\.xml|llms\.txt|llms-full\.txt)$/;

/**
 * `revalidate` (stale-while-revalidate) lets Cloudflare hand out the stored
 * copy at once and refresh it in the background. Without it an expired copy
 * waited for the origin, and when the host hangs instead of failing that was up
 * to 100 s before stale-if-error applied (23-nov: robots.txt took over 60 s).
 */
export function outageEdgePolicy(fresh: number, revalidate = 0): string {
  const swr = revalidate > 0 ? `, stale-while-revalidate=${revalidate}` : '';
  return `public, max-age=${fresh}${swr}, stale-if-error=${ORIGIN_OUTAGE_STALE}`;
}

export function isCrawlFile(request: Request, response: Response, environment?: string): boolean {
  const url = new URL(request.url);
  return environment === 'production' && url.origin === CANONICAL_ORIGIN && request.method === 'GET' && !url.search
    && CRAWL_FILE.test(url.pathname) && response.status === 200 && !response.headers.has('set-cookie')
    && !request.headers.has('authorization');
}

/**
 * Cloudflare policy at the Node boundary. Anything not listed stays `no-store`:
 * APIs, errors, previews, editors and personal renders never reach the edge.
 * `anonymousPage` is the caller's check on the rendered HTML (no cookie in the
 * request, no Set-Cookie, nothing private); the page must also have opted into
 * the origin cache, whose expiry already stops at the next promotion boundary.
 */
export function nodeEdgePolicy(request: Request, response: Response, environment: string | undefined,
  options: { anonymousPage: boolean; redirect: boolean }, now = Date.now()): string {
  if (options.anonymousPage) {
    const until = Number(response.headers.get(FRESH_UNTIL_HEADER));
    const remaining = Math.floor(until - now / 1000);
    if (!Number.isFinite(until) || until <= 0 || remaining < 1) return 'no-store';
    // Background refresh only up to the origin's own expiry: a page is never
    // served past the next promotion boundary except while the origin is down.
    const fresh = Math.min(ORIGIN_EDGE_FRESH, remaining);
    return outageEdgePolicy(fresh, remaining - fresh);
  }
  // Redirects and crawl files do not depend on promotions.
  if (options.redirect && isSharedRedirect(request, response, environment)) return outageEdgePolicy(ORIGIN_EDGE_FRESH, ORIGIN_OUTAGE_STALE);
  if (isCrawlFile(request, response, environment)) return outageEdgePolicy(ORIGIN_EDGE_FRESH, ORIGIN_OUTAGE_STALE);
  return 'no-store';
}

/** Originals behind Cloudflare image variants; media writes purge this tag. */
export const MEDIA_TAG = 'sably:media';
export const MEDIA_EDGE_TTL = 2_592_000;
export const REDIRECT_EDGE_TTL = 86_400;

const CANONICAL_ORIGIN = 'https://sably.co';
const MEDIA_FILE = /^\/_emdash\/api\/media\/file\/[^?#]+$/;
const MEDIA_TYPE = /^(?:image|video|audio)\//i;
/** Ad and analytics parameters; the server never reads them (the browser still does). */
const TRACKING_PARAM = /^(?:utm_[a-z0-9_]+|gclid|gclsrc|gbraid|wbraid|gad_source|gad_campaignid|dclid|fbclid|msclkid|ttclid|twclid|li_fat_id|igshid|mc_cid|mc_eid|_gl|srsltid|yclid|rdt_cid|epik|s_kwcid|ef_id|hsa_[a-z]+)$/i;
/** EmDash session/edit state and Cloudflare Access: these requests render personally. */
const PERSONAL_COOKIE = /(?:^|;\s*)(?:astro-session|emdash[-_][^=;]*|CF_Authorization)=/i;

export interface DeliveryPolicy {
  /** A permanent redirect produced by Sably's own fast path, safe to share. */
  redirect?: boolean;
  /** The anonymous page served from the Worker's Cache API for this request. */
  shared?: boolean;
}

export function canCachePublicPage(request: Request, environment: string | undefined): boolean {
  const url = new URL(request.url);
  if (environment !== 'production' || url.origin !== CANONICAL_ORIGIN || request.method !== 'GET' || url.search) return false;
  // No shared response for an editor, preview, authenticated caller or personalized session.
  if (['cookie', 'authorization', 'range', 'x-sably-preview-token'].some(name => request.headers.has(name))) return false;
  if (/no-cache|no-store|max-age=0/i.test(request.headers.get('cache-control') ?? '') || request.headers.has('pragma')) return false;
  // Cuenta (src/lib/cuenta): acceso y Mi cuenta son personales; nunca se guardan en ninguna caché.
  if (!url.pathname.endsWith('/') || /^\/(?:_|admin(?:\/|$)|api(?:\/|$)|ingresar(?:\/|$)|mi-cuenta(?:\/|$))/.test(url.pathname)) return false;
  return !/%|\/\//.test(url.pathname);
}

/**
 * The anonymous form of a public page request, or null when there is nothing
 * to strip or the visitor may see a personal render. GA/Clarity cookies,
 * reloads and ad click IDs otherwise give every view its own cache key.
 */
export function sharedPublicRequest(request: Request, environment: string | undefined): Request | null {
  if (environment !== 'production' || request.method !== 'GET') return null;
  if (['authorization', 'range', 'x-sably-preview-token'].some(name => request.headers.has(name))) return null;
  const cookie = request.headers.get('cookie') ?? '';
  if (PERSONAL_COOKIE.test(cookie)) return null;
  const url = new URL(request.url);
  const params = [...url.searchParams.keys()];
  if (!params.every(name => TRACKING_PARAM.test(name))) return null;
  if (!cookie && !params.length && !request.headers.has('cache-control') && !request.headers.has('pragma')) return null;
  url.search = '';
  const headers = new Headers(request.headers);
  for (const name of ['cookie', 'cache-control', 'pragma']) headers.delete(name);
  const shared = new Request(url, { method: 'GET', headers });
  return canCachePublicPage(shared, environment) ? shared : null;
}

function edgeMaxAge(policy: string): number {
  return Number(policy.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 0);
}

function isCacheableMedia(request: Request, response: Response, environment?: string): boolean {
  const url = new URL(request.url);
  return environment === 'production' && url.origin === CANONICAL_ORIGIN && request.method === 'GET' && !url.search
    && MEDIA_FILE.test(url.pathname) && response.status === 200 && !request.headers.has('authorization')
    && MEDIA_TYPE.test(response.headers.get('content-type') ?? '') && !response.headers.has('set-cookie')
    && !/private|no-store/i.test(response.headers.get('cache-control') ?? '');
}

function isSharedPublicData(request: Request, response: Response, environment?: string): boolean {
  const url = new URL(request.url);
  const edgePolicy = response.headers.get('cloudflare-cdn-cache-control') ?? '';
  return environment === 'production' && url.origin === CANONICAL_ORIGIN && request.method === 'GET' && !url.search
    && PUBLIC_DATA_PATHS.has(url.pathname) && response.status === 200 && !request.headers.has('authorization')
    && /^public\b/i.test(edgePolicy) && edgeMaxAge(edgePolicy) <= PUBLIC_DATA_TTL
    && !response.headers.has('set-cookie');
}

function isSharedRedirect(request: Request, response: Response, environment?: string): boolean {
  const url = new URL(request.url);
  const location = response.headers.get('location');
  return environment === 'production' && url.origin === CANONICAL_ORIGIN && request.method === 'GET'
    && (response.status === 301 || response.status === 308) && !!location
    && new URL(location, url).origin === CANONICAL_ORIGIN;
}

/**
 * Workers Cache runs BEFORE the Worker. Only anonymous renders are ever stored
 * (`canCachePublicPage` refuses any cookie), so the entry is shared whatever
 * cookies the visitor carries: GA/Clarity set them on the first view, and
 * varying on them sent every later view back to the Worker. Credentials,
 * previews and ranges still get their own variant.
 */
export function protectDeliveryResponse(request: Request, response: Response, environment?: string, policy: DeliveryPolicy = {}): Response {
  const headers = new Headers(response.headers);
  const html = headers.get('content-type')?.includes('text/html');
  const browserPolicy = headers.get('cache-control') ?? '';
  const edgePolicy = headers.get('cloudflare-cdn-cache-control') ?? '';
  const edgeTtl = edgeMaxAge(edgePolicy);
  const swr = Number(edgePolicy.match(/stale-while-revalidate=(\d+)/i)?.[1] ?? 0);
  const cacheable = html && response.status === 200 && canCachePublicPage(request, environment)
    && edgeTtl > 0 && edgeTtl <= PUBLIC_PAGE_TTL && swr <= PUBLIC_PAGE_SWR && !/private|no-store|no-cache/i.test(edgePolicy)
    && !headers.has('set-cookie') && !/private|no-store/i.test(browserPolicy)
    && !headers.get('vary')?.includes('*');
  if (cacheable) {
    const vary = new Set((headers.get('vary') ?? '').split(',').map(v => v.trim()).filter(Boolean));
    for (const name of ['Authorization', 'X-Sably-Preview-Token', 'Range']) vary.add(name);
    headers.set('Vary', [...vary].join(', '));
    // Cloudflare uses Astro's edge TTL; the browser always checks for a fresh page.
    // No must-revalidate: it would also forbid the edge from serving stale.
    headers.set('Cache-Control', 'max-age=0');
  } else if (policy.shared && html && response.status === 200) {
    // Same anonymous HTML as the cached entry; never stored under this visitor's key.
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    headers.set('Cache-Control', 'max-age=0');
  } else if (isCacheableMedia(request, response, environment)) {
    // EmDash keeps image keys revalidating in the browser because "Replace" may
    // overwrite them; the edge keeps them until a media write purges the tag.
    headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${MEDIA_EDGE_TTL}`);
    headers.set('Cache-Tag', MEDIA_TAG);
  } else if (isSharedPublicData(request, response, environment)) {
    headers.set('Cache-Tag', PUBLIC_PAGE_TAG);
  } else if (policy.redirect && isSharedRedirect(request, response, environment)) {
    headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${REDIRECT_EDGE_TTL}`);
    headers.set('Cache-Control', 'public, max-age=3600');
  } else if (!new URL(request.url).pathname.startsWith('/_astro/')) {
    // Explicitly fence other redirects, errors, APIs and setup from heuristic Worker caching.
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    if (html || response.status >= 400) headers.set('Cache-Control', 'private, no-store');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Tags a successful write invalidates, or none. Visitor-triggered writes never purge. */
export function invalidatedTags(request: Request, response: Response): string[] {
  if (request.method === 'GET' || request.method === 'HEAD' || !response.ok) return [];
  const { pathname } = new URL(request.url);
  if (/^\/_emdash\/api\/plugins\/sably-(?:operations|whatsapp|integrations|seo|publicidad)\//.test(pathname)) return [PUBLIC_PAGE_TAG];
  // Ajustes de esos plugins desde «Ajustes» de EmDash (tema por defecto, caja de compra…).
  if (/^\/_emdash\/api\/admin\/plugins\/sably-(?:operations|whatsapp|integrations|seo|publicidad)\/settings\/?$/.test(pathname)) return [PUBLIC_PAGE_TAG];
  // Token-gated operational refreshes (Hotmart prices/ratings, catalog subjects).
  if (request.method === 'POST' && /^\/api\/v1\/(?:precios|subjects)\/?$/.test(pathname)) return [PUBLIC_PAGE_TAG];
  // Upload, replace or delete: the original and every page embedding it.
  if (/^\/_emdash\/api\/media(?:\/|$)/.test(pathname)) return [MEDIA_TAG, PUBLIC_PAGE_TAG];
  return [];
}
