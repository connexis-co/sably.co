import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { dispatchLegacyApi, type LegacyBindings } from '../../../lib/legacy-backend';
import { validateCaptureRequest } from '../../../plugins/sably-operations/catalog-api';
export const prerender = false;
export const GET: APIRoute = ({request}) => dispatchLegacyApi(request,env as LegacyBindings,'v1/precios');
export const POST: APIRoute = async ({request}) => {
  const validated = await validateCaptureRequest(request,env as LegacyBindings);
  return validated instanceof Response ? validated : dispatchLegacyApi(validated,env as LegacyBindings,'v1/precios');
};
