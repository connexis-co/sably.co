import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from '../runtime-environment';
import { parseLegacyRedirects, productionOriginRedirect, publicCanonicalRedirect, resolveLegacyRedirect, rootCountryRedirect } from '../legacy-redirects';
import { PARAMETRO_TEMA } from '../tema';
import { canCachePublicPage, FRESH_UNTIL_HEADER, invalidatedTags, isCrawlFile, nodeEdgePolicy, ORIGIN_EDGE_FRESH, protectDeliveryResponse } from '../public-delivery';

/** Preserve the Worker boundary while keeping all execution at the Node origin. */
export function createNodeRequestHandler(options: {
  env: RuntimeEnvironment;
  redirects: string;
  invalidate: () => void;
}) {
  const legacy = parseLegacyRedirects(options.redirects);
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const finish = (response: Response, redirect = false) => {
      const html = response.headers.get('content-type')?.includes('text/html');
      const anonymous = html && response.status === 200 && canCachePublicPage(request, options.env.SABLY_ENVIRONMENT)
        && !response.headers.has('set-cookie') && !/private|no-store/i.test(response.headers.get('cache-control') ?? '');
      const protectedResponse = protectEnvironmentResponse(
        protectDeliveryResponse(request, response, options.env.SABLY_ENVIRONMENT, { redirect }), options.env);
      const headers = new Headers(protectedResponse.headers);
      // The origin owns invalidation, so Cloudflare only keeps a short-lived
      // copy of anonymous pages, permanent redirects and crawl files, and serves
      // it beyond that only while the origin is down. Everything else: no-store.
      const edge = nodeEdgePolicy(request, protectedResponse, options.env.SABLY_ENVIRONMENT, { anonymousPage: !!anonymous, redirect });
      headers.set('Cloudflare-CDN-Cache-Control', edge);
      headers.delete(FRESH_UNTIL_HEADER);
      if (anonymous) headers.set('Cache-Control', 'max-age=0');
      else if (edge !== 'no-store' && isCrawlFile(request, protectedResponse, options.env.SABLY_ENVIRONMENT)) {
        headers.set('Cache-Control', `public, max-age=${ORIGIN_EDGE_FRESH}`);
      }
      // ?tema=v2 / ?tema=clasico: vista de revisión del rediseño (src/lib/tema.ts). Nunca se indexa;
      // la página ya lleva canónica limpia y no entra en caché (tiene query).
      if (html && new URL(request.url).searchParams.has(PARAMETRO_TEMA)) headers.set('X-Robots-Tag', 'noindex, follow');
      headers.set('X-Sably-Runtime', 'node');
      headers.set('X-Sably-Environment', options.env.SABLY_ENVIRONMENT ?? 'unconfigured');
      return new Response(protectedResponse.body, { status: protectedResponse.status, statusText: protectedResponse.statusText, headers });
    };
    try {
      const origin = productionOriginRedirect(request, options.env.SABLY_ENVIRONMENT, legacy);
      if (origin) return finish(origin, true);
      const denied = await gateEnvironment(request, options.env);
      if (denied) return finish(denied);
      const redirect = rootCountryRedirect(request) ?? resolveLegacyRedirect(request, legacy) ?? publicCanonicalRedirect(request);
      if (redirect) return finish(redirect, true);
      const response = await next();
      if (invalidatedTags(request, response).length) options.invalidate();
      return finish(response);
    } catch (error) {
      console.error('Sably Node request failed', error);
      return finish(new Response('Service unavailable', { status: 503 }));
    }
  };
}
