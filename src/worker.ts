import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from './lib/runtime-environment';
import redirectSource from '../public/_redirects?raw';
import { parseLegacyRedirects, publicCanonicalRedirect, resolveLegacyRedirect, productionOriginRedirect, rootCountryRedirect } from './lib/legacy-redirects';
import { protectDeliveryResponse, invalidatedTags, sharedPublicRequest, type DeliveryPolicy } from './lib/public-delivery';
import { serveSharedPage, sharedCacheKey } from './lib/shared-page-cache';

const legacyRedirects = parseLegacyRedirects(redirectSource);

export { PluginBridge };

type VersionedEnvironment = RuntimeEnvironment & { CF_VERSION_METADATA?: { id?: string } };

export default {
  ...handler,
  async fetch(request, env, ctx) {
    const finish = (response: Response, policy?: DeliveryPolicy) =>
      protectEnvironmentResponse(protectDeliveryResponse(request, response, env.SABLY_ENVIRONMENT, policy), env);
    const origin=productionOriginRedirect(request,env.SABLY_ENVIRONMENT,legacyRedirects);
    if(origin)return finish(origin);
    const denied = await gateEnvironment(request, env);
    if (denied) return finish(denied);
    try {
      // Answered before EmDash initialises, and shared from the edge cache.
      const redirect = rootCountryRedirect(request) ?? resolveLegacyRedirect(request, legacyRedirects) ?? publicCanonicalRedirect(request);
      if (redirect) return finish(redirect, { redirect: true });
      if (!handler.fetch) throw new Error('EmDash fetch handler unavailable');
      const emdash = handler.fetch;
      // Ad click IDs give every visit its own URL: those get the anonymous page
      // from the Worker's Cache API instead of rendering one page per click.
      const shared = sharedPublicRequest(request, env.SABLY_ENVIRONMENT);
      // Same URL, only cookies or reload headers: render anonymously so Workers
      // Cache stores it under this URL for every visitor.
      if (shared && !new URL(request.url).search) {
        const anonymous = shared as Parameters<typeof emdash>[0];
        return protectEnvironmentResponse(protectDeliveryResponse(shared, await emdash(anonymous, env, ctx), env.SABLY_ENVIRONMENT), env);
      }
      if (shared) {
        const page = await serveSharedPage(shared, sharedCacheKey(shared, (env as VersionedEnvironment).CF_VERSION_METADATA?.id ?? ''), {
          cache: (caches as unknown as { default: Cache }).default,
          render: async anonymous => protectDeliveryResponse(anonymous, await emdash(anonymous as Parameters<typeof emdash>[0], env, ctx), env.SABLY_ENVIRONMENT),
          waitUntil: promise => ctx.waitUntil(promise),
        });
        return finish(page, { shared: true });
      }
      const response = await handler.fetch(request, env, ctx);
      const tags = env.SABLY_ENVIRONMENT === 'production' ? invalidatedTags(request, response) : [];
      if (tags.length) {
        ctx.waitUntil(import('cloudflare:workers').then(async ({ cache }) => {
          const result = await cache.purge({ tags });
          if (!result.success) throw new Error('Cache purge was not accepted');
        }).catch(() => console.error('Public cache invalidation failed; TTL will refresh pages.')));
      }
      return finish(response);
    } catch (error) {
      console.error('Sably request failed', error);
      return finish(new Response('Service unavailable', { status: 503 }));
    }
  },
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler<RuntimeEnvironment>;
