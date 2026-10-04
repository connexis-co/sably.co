import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from './lib/runtime-environment';
import redirectSource from '../public/_redirects?raw';
import { parseLegacyRedirects, publicCanonicalRedirect, resolveLegacyRedirect,productionOriginRedirect } from './lib/legacy-redirects';
import { protectDeliveryResponse, changesPublicPlugin, PUBLIC_PAGE_TAG } from './lib/public-delivery';

const legacyRedirects = parseLegacyRedirects(redirectSource);

export { PluginBridge };

export default {
  ...handler,
  async fetch(request, env, ctx) {
    const finish = (response: Response) => protectEnvironmentResponse(protectDeliveryResponse(request, response, env.SABLY_ENVIRONMENT), env);
    const origin=productionOriginRedirect(request,env.SABLY_ENVIRONMENT,legacyRedirects);
    if(origin)return finish(origin);
    const denied = await gateEnvironment(request, env);
    if (denied) return finish(denied);
    try {
      const redirect = resolveLegacyRedirect(request, legacyRedirects);
      if (redirect) return finish(redirect);
      const canonical = publicCanonicalRedirect(request);
      if (canonical) return finish(canonical);
      if (!handler.fetch) throw new Error('EmDash fetch handler unavailable');
      const response = await handler.fetch(request, env, ctx);
      if (env.SABLY_ENVIRONMENT === 'production' && changesPublicPlugin(request, response)) {
        ctx.waitUntil(import('cloudflare:workers').then(async ({ cache }) => {
          const result = await cache.purge({ tags: [PUBLIC_PAGE_TAG] });
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
