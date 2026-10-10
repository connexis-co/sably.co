import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from '../runtime-environment';
import { parseLegacyRedirects, productionOriginRedirect, publicCanonicalRedirect, resolveLegacyRedirect, rootCountryRedirect } from '../legacy-redirects';
import { canCachePublicPage, invalidatedTags, protectDeliveryResponse } from '../public-delivery';

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
      // Editorial content, APIs and mutable originals are invalidated at the
      // origin. Static bundles still use the adapter/nginx cache policy.
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      if (anonymous) headers.set('Cache-Control', 'max-age=0');
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
