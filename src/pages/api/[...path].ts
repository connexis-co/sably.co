import type { APIRoute } from 'astro';
import { env } from 'virtual:sably-runtime';
import { withEmDashRuntime } from 'emdash/middleware';
import { dispatchLegacyApi } from '../../lib/legacy-backend';
import { resolveLegacyApiRuntime } from '../../lib/legacy-api-runtime';

export const prerender = false;

/** EmDash's own concrete API routes take precedence over this legacy fallback. */
export const ALL: APIRoute = async ({ request, params }) => {
  const path = params.path ?? '';
  const { bindings, mail } = await resolveLegacyApiRuntime(path, env, request.url, withEmDashRuntime);
  return dispatchLegacyApi(request, bindings, path, mail);
};
