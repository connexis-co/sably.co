import memoryProvider from 'astro/cache/memory';
import type { CacheProvider, CacheProviderFactory } from 'astro';
import { canCachePublicPage, FRESH_UNTIL_HEADER, nodeEdgePolicy } from '../public-delivery';

const caches = new Set<() => void>();

/** A new store also retires in-flight renders; they cannot repopulate it after a write. */
export function invalidateNodePages(): void {
  for (const reset of caches) reset();
}

const nodeCacheProvider: CacheProviderFactory = config => {
  let cache: CacheProvider = memoryProvider({ max: 1000, ...config });
  const reset = () => { cache = memoryProvider({ max: 1000, ...config }); };
  caches.add(reset);
  return {
    name: 'sably-node',
    setHeaders(options) {
      const headers = new Headers();
      // Promotion boundaries are hard deadlines on the persistent origin.
      // Wait for a fresh render on expiry rather than serving a stale offer.
      if (options.maxAge !== undefined) {
        headers.set('CDN-Cache-Control', `max-age=${options.maxAge}`);
        // Travels with the stored copy: the boundary sets how long Cloudflare may call it fresh.
        headers.set(FRESH_UNTIL_HEADER, String(Math.floor(Date.now() / 1000) + options.maxAge));
      }
      if (options.tags?.length) headers.set('Cache-Tag', options.tags.join(', '));
      if (options.etag) headers.set('ETag', options.etag);
      if (options.lastModified) headers.set('Last-Modified', options.lastModified.toUTCString());
      return headers;
    },
    async onRequest(context, next) {
      // Astro's generic memory provider only keys by URL. An editor/preview
      // must reach EmDash authentication even if an anonymous copy exists.
      if (!canCachePublicPage(context.request, process.env.SABLY_ENVIRONMENT)) return next();
      const response = await cache.onRequest!(context, async () => {
        const rendered = await next();
        if (rendered.status !== 200 || /private|no-store/i.test(rendered.headers.get('cache-control') ?? '')) {
          rendered.headers.delete('CDN-Cache-Control');
        }
        return rendered;
      });
      // This provider wraps the request boundary and Astro adds the cache
      // headers after it, so the edge policy for pages is decided here: an
      // anonymous page gets the short copy that outlives an origin outage
      // (nodeEdgePolicy); anything else keeps what the boundary set.
      const html = response.headers.get('content-type')?.includes('text/html');
      const anonymousPage = !!html && response.status === 200 && !response.headers.has('set-cookie')
        && !/private|no-store/i.test(response.headers.get('cache-control') ?? '');
      if (anonymousPage) {
        response.headers.set('Cloudflare-CDN-Cache-Control',
          nodeEdgePolicy(context.request, response, process.env.SABLY_ENVIRONMENT, { anonymousPage, redirect: false }));
      } else if (!response.headers.has('Cloudflare-CDN-Cache-Control')) {
        response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      }
      response.headers.delete(FRESH_UNTIL_HEADER);
      return response;
    },
    async invalidate() { invalidateNodePages(); },
  };
};

export default nodeCacheProvider;
