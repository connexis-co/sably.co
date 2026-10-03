import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { dispatchLegacyApi, type LegacyBindings } from '../../lib/legacy-backend';

export const prerender = false;

/** EmDash's own concrete API routes take precedence over this legacy fallback. */
export const ALL: APIRoute = ({ request, params }) =>
  dispatchLegacyApi(request, env as LegacyBindings, params.path ?? '');
