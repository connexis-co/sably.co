import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { dispatchLegacyApi, type LegacyBindings } from '../../lib/legacy-backend';
import { OptionsRepository } from 'emdash';
import { integrationSettings } from '../../lib/integration-settings';
import { resolveIntegrationBindings } from '../../plugins/sably-integrations/model';
import { resolveOperationalMail } from '../../lib/operational-mail';

export const prerender = false;

/** EmDash's own concrete API routes take precedence over this legacy fallback. */
export const ALL: APIRoute = async ({ request, params, locals }) => {
  const path = params.path ?? '';
  const mail = ['v1/leads','v1/abandonos-notify'].includes(path.replace(/\/$/,'')) && locals.emdash
    ? await resolveOperationalMail(env as LegacyBindings,request.url,{email:locals.emdash.email,settings:new OptionsRepository(locals.emdash.db)})
    : undefined;
  const bindings = path.replace(/\/$/,'') === 'hotmart-webhook' && locals.emdash
    ? await resolveIntegrationBindings(env as LegacyBindings,request.url,await integrationSettings(locals.emdash.db,env))
    : env as LegacyBindings;
  return dispatchLegacyApi(request, bindings, path, mail);
};
