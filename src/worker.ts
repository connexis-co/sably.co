import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from './lib/runtime-environment';
import redirectSource from '../public/_redirects?raw';
import { parseLegacyRedirects, publicCanonicalRedirect, resolveLegacyRedirect, productionOriginRedirect, rootCountryRedirect } from './lib/legacy-redirects';
import { protectDeliveryResponse, invalidatedTags, sharedPublicRequest, type DeliveryPolicy } from './lib/public-delivery';

const legacyRedirects = parseLegacyRedirects(redirectSource);

export { PluginBridge };

type LoopbackContext = ExecutionContext & { exports?: { default?: Fetcher } };

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
      // Analytics cookies, reloads and ad click IDs re-enter through the cache
      // with the anonymous request instead of rendering one page per visitor.
      const shared = sharedPublicRequest(request, env.SABLY_ENVIRONMENT);
      const loopback = (ctx as LoopbackContext).exports?.default;
      if (shared && loopback) return finish(await loopback.fetch(shared), { shared: true });
      if (!handler.fetch) throw new Error('EmDash fetch handler unavailable');
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
