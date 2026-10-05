import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from './lib/runtime-environment';
import redirectSource from '../public/_redirects?raw';
import { parseLegacyRedirects, publicCanonicalRedirect, resolveLegacyRedirect, productionOriginRedirect, rootCountryRedirect } from './lib/legacy-redirects';
import { canCachePublicPage, protectDeliveryResponse, invalidatedTags, sharedPublicRequest, type DeliveryPolicy } from './lib/public-delivery';
import { bumpPageGeneration, servePage } from './lib/page-store';

const legacyRedirects = parseLegacyRedirects(redirectSource);

export { PluginBridge };

type VersionedEnvironment = RuntimeEnvironment & { CF_VERSION_METADATA?: { id?: string }; CACHE?: KVNamespace };

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
      const kv = (env as VersionedEnvironment).CACHE;
      // Anonymous pages (also with analytics cookies, reloads or ad click IDs) come
      // from the global page store when Workers Cache misses in this colo.
      const anonymous = canCachePublicPage(request, env.SABLY_ENVIRONMENT) ? request : sharedPublicRequest(request, env.SABLY_ENVIRONMENT);
      if (anonymous && kv) {
        const page = await servePage(anonymous, {
          kv, version: (env as VersionedEnvironment).CF_VERSION_METADATA?.id ?? '',
          render: async r => protectDeliveryResponse(r, await emdash(r as Parameters<typeof emdash>[0], env, ctx), env.SABLY_ENVIRONMENT),
          waitUntil: promise => ctx.waitUntil(promise),
        });
        // Same URL: Workers Cache keeps it for every visitor. Ad click IDs give each
        // visit its own URL, so that copy is not stored under the visitor's key.
        if (!new URL(request.url).search) return protectEnvironmentResponse(protectDeliveryResponse(anonymous, page, env.SABLY_ENVIRONMENT), env);
        return finish(page, { shared: true });
      }
      const response = await handler.fetch(request, env, ctx);
      const tags = env.SABLY_ENVIRONMENT === 'production' ? invalidatedTags(request, response) : [];
      if (tags.length) {
        ctx.waitUntil(import('cloudflare:workers').then(async ({ cache }) => {
          const [result] = await Promise.all([cache.purge({ tags }), kv ? bumpPageGeneration(kv) : undefined]);
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
