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
  /** The anonymous page returned through the cached loopback for this request. */
  shared?: boolean;
}

export function canCachePublicPage(request: Request, environment: string | undefined): boolean {
  const url = new URL(request.url);
  if (environment !== 'production' || url.origin !== CANONICAL_ORIGIN || request.method !== 'GET' || url.search) return false;
  // No shared response for an editor, preview, authenticated caller or personalized session.
  if (['cookie', 'authorization', 'range', 'x-sably-preview-token'].some(name => request.headers.has(name))) return false;
  if (/no-cache|no-store|max-age=0/i.test(request.headers.get('cache-control') ?? '') || request.headers.has('pragma')) return false;
  if (!url.pathname.endsWith('/') || /^\/(?:_|admin(?:\/|$)|api(?:\/|$))/.test(url.pathname)) return false;
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

/** Workers Cache runs BEFORE the Worker. Vary separates private requests even on a HIT. */
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
    for (const name of ['Cookie', 'Authorization', 'X-Sably-Preview-Token', 'Range', 'Cache-Control', 'Pragma']) vary.add(name);
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
  if (/^\/_emdash\/api\/plugins\/sably-(?:operations|whatsapp|integrations|seo)\//.test(pathname)) return [PUBLIC_PAGE_TAG];
  // Token-gated operational refreshes (Hotmart prices/ratings, catalog subjects).
  if (request.method === 'POST' && /^\/api\/v1\/(?:precios|subjects)\/?$/.test(pathname)) return [PUBLIC_PAGE_TAG];
  // Upload, replace or delete: the original and every page embedding it.
  if (/^\/_emdash\/api\/media(?:\/|$)/.test(pathname)) return [MEDIA_TAG, PUBLIC_PAGE_TAG];
  return [];
}
