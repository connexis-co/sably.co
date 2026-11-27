import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from '../runtime-environment';
import { parseLegacyRedirects, productionOriginRedirect, publicCanonicalRedirect, resolveLegacyRedirect, rootCountryRedirect, crawlerArtifactRedirect } from '../legacy-redirects';
import { PARAMETRO_TEMA } from '../tema';
import { canCachePublicPage, FRESH_UNTIL_HEADER, invalidatedTags, isCrawlFile, nodeEdgePolicy, ORIGIN_EDGE_FRESH, originCacheRequest, protectDeliveryResponse } from '../public-delivery';

/** Preserve the Worker boundary while keeping all execution at the Node origin. */
/** `Astro.locals` interno con la ruta pedida cuando se reescribe a la página 404 (la plantilla elige el país con ella). */
export const RUTA_PEDIDA_404 = 'rutaPedida404';

/** Rutas que no son una página que ve un visitante: su 404 se queda como está. */
const SIN_PLANTILLA_404 = /^\/(api|_emdash|_astro|cdn-cgi|sitemaps|admin)(\/|$)|\.[a-z0-9]{2,5}$/i;

/** Un 404 sin HTML (texto plano de un cargador de páginas) en una URL de navegación: se sustituye por la plantilla de 404. */
export function necesitaPagina404(request: Request, response: Response): boolean {
  if (response.status !== 404 || !['GET', 'HEAD'].includes(request.method)) return false;
  if ((response.headers.get('content-type') ?? '').includes('text/html')) return false;
  return !SIN_PLANTILLA_404.test(new URL(request.url).pathname);
}

export function createNodeRequestHandler(options: {
  env: RuntimeEnvironment;
  redirects: string;
  invalidate: () => void;
}) {
  const legacy = parseLegacyRedirects(options.redirects);
  return async (request: Request, next: (rewrite?: string) => Promise<Response>, locals?: object): Promise<Response> => {
    const finish = (response: Response, redirect = false) => {
      const html = response.headers.get('content-type')?.includes('text/html');
      // Una página 200 con solo parámetros de seguimiento es la misma que la limpia:
      // mismas cabeceras de caché. Redirecciones y errores conservan la petición tal cual.
      const policyRequest = html && response.status === 200 ? originCacheRequest(request, options.env.SABLY_ENVIRONMENT) : request;
      const anonymous = html && response.status === 200 && canCachePublicPage(policyRequest, options.env.SABLY_ENVIRONMENT)
        && !response.headers.has('set-cookie') && !/private|no-store/i.test(response.headers.get('cache-control') ?? '');
      const protectedResponse = protectEnvironmentResponse(
        protectDeliveryResponse(policyRequest, response, options.env.SABLY_ENVIRONMENT, { redirect }), options.env);
      const headers = new Headers(protectedResponse.headers);
      // The origin owns invalidation, so Cloudflare only keeps a short-lived
      // copy of anonymous pages, permanent redirects and crawl files, and serves
      // it beyond that only while the origin is down. Everything else: no-store.
      const edge = nodeEdgePolicy(policyRequest, protectedResponse, options.env.SABLY_ENVIRONMENT, { anonymousPage: !!anonymous, redirect });
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
      const redirect = crawlerArtifactRedirect(request) ?? rootCountryRedirect(request) ?? resolveLegacyRedirect(request, legacy) ?? publicCanonicalRedirect(request);
      if (redirect) return finish(redirect, true);
      let response = await next();
      if (necesitaPagina404(request, response)) {
        // Plantilla del sitio (cabecera, pie, buscador) con estado 404 real, sin caché y sin indexar.
        try {
          // La reescritura conserva cookies y ?tema=; la ruta pedida viaja en una cabecera para elegir el país.
          if (locals) (locals as Record<string, unknown>)[RUTA_PEDIDA_404] = new URL(request.url).pathname;
          const pagina = await next('/404');
          if ((pagina.headers.get('content-type') ?? '').includes('text/html')) {
            const cabeceras = new Headers(pagina.headers);
            cabeceras.set('Cache-Control', 'no-store');
            cabeceras.set('X-Robots-Tag', 'noindex, nofollow');
            response = new Response(request.method === 'HEAD' ? null : pagina.body, { status: 404, headers: cabeceras });
          }
        } catch (error) { console.error('Sably 404 template failed', error); }
      }
      if (invalidatedTags(request, response).length) options.invalidate();
      return finish(response);
    } catch (error) {
      console.error('Sably Node request failed', error);
      return finish(new Response('Service unavailable', { status: 503 }));
    }
  };
}
