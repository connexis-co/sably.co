/** Short-lived HTML cache, invalidated by EmDash's native editorial tags. */
export const PUBLIC_PAGE_TTL = 60;
export const PUBLIC_PAGE_TAG = 'sably:public';
export const PUBLIC_PAGE_TAGS = [PUBLIC_PAGE_TAG, 'emdash:settings',
  'emdash:menu:primary', 'emdash:menu:footer', 'emdash:menu:social', 'emdash:menu:ecosystem',
  'courses', 'course_locales', 'categories', 'countries', 'cities',
  'creators', 'blog', 'pages', 'testimonials', 'homologaciones'];

export function canCachePublicPage(request: Request, environment: string | undefined): boolean {
  const url = new URL(request.url);
  if (environment !== 'production' || url.origin !== 'https://sably.co' || request.method !== 'GET' || url.search) return false;
  // No shared response for an editor, preview, authenticated caller or personalized session.
  if (['cookie', 'authorization', 'range', 'x-sably-preview-token'].some(name => request.headers.has(name))) return false;
  if (/no-cache|no-store|max-age=0/i.test(request.headers.get('cache-control') ?? '') || request.headers.has('pragma')) return false;
  if (!url.pathname.endsWith('/') || /^\/(?:_|admin(?:\/|$)|api(?:\/|$))/.test(url.pathname)) return false;
  return !/%|\/\//.test(url.pathname);
}

/** Workers Cache runs BEFORE the Worker. Vary separates private requests even on a HIT. */
export function protectDeliveryResponse(request: Request, response: Response, environment?: string): Response {
  const headers = new Headers(response.headers);
  const html = headers.get('content-type')?.includes('text/html');
  const policy = headers.get('cache-control') ?? '';
  const edgePolicy = headers.get('cloudflare-cdn-cache-control') ?? '';
  const edgeTtl = Number(edgePolicy.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 0);
  const cacheable = html && response.status === 200 && canCachePublicPage(request, environment)
    && edgeTtl > 0 && edgeTtl <= PUBLIC_PAGE_TTL && !/private|no-store|no-cache/i.test(edgePolicy)
    && !headers.has('set-cookie') && !/private|no-store/i.test(policy)
    && !headers.get('vary')?.includes('*');
  if (cacheable) {
    const vary = new Set((headers.get('vary') ?? '').split(',').map(v => v.trim()).filter(Boolean));
    for (const name of ['Cookie', 'Authorization', 'X-Sably-Preview-Token', 'Range', 'Cache-Control', 'Pragma']) vary.add(name);
    headers.set('Vary', [...vary].join(', '));
    // Let Cloudflare use Astro's TTL while the browser always checks for a fresh page.
    headers.set('Cache-Control', 'max-age=0, must-revalidate');
  } else if (!new URL(request.url).pathname.startsWith('/_astro/')) {
    // Explicitly fence redirects, errors, APIs and setup from heuristic Worker caching.
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    if (html || response.status >= 400) headers.set('Cache-Control', 'private, no-store');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function changesPublicPlugin(request: Request, response: Response): boolean {
  return request.method !== 'GET' && request.method !== 'HEAD' && response.ok
    && /^\/_emdash\/api\/plugins\/sably-(?:operations|whatsapp|integrations|seo)\//.test(new URL(request.url).pathname);
}
