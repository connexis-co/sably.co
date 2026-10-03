import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
import { gateEnvironment, protectEnvironmentResponse, type RuntimeEnvironment } from './lib/runtime-environment';
import redirectSource from '../public/_redirects?raw';
import { parseLegacyRedirects, publicCanonicalRedirect, resolveLegacyRedirect } from './lib/legacy-redirects';

const legacyRedirects = parseLegacyRedirects(redirectSource);

export { PluginBridge };

export default {
  ...handler,
  async fetch(request, env, ctx) {
    const denied = await gateEnvironment(request, env);
    if (denied) return denied;
    try {
      const redirect = resolveLegacyRedirect(request, legacyRedirects);
      if (redirect) return protectEnvironmentResponse(redirect, env);
      const canonical = publicCanonicalRedirect(request);
      if (canonical) return protectEnvironmentResponse(canonical, env);
      if (!handler.fetch) throw new Error('EmDash fetch handler unavailable');
      return protectEnvironmentResponse(await handler.fetch(request, env, ctx), env);
    } catch (error) {
      console.error('Sably request failed', error);
      return protectEnvironmentResponse(new Response('Service unavailable', { status: 503 }), env);
    }
  },
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler<RuntimeEnvironment>;
