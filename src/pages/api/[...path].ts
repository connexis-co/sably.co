import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { dispatchLegacyApi, type LegacyBindings } from '../../lib/legacy-backend';
import { OptionsRepository } from 'emdash';
import { resolveOperationalMail } from '../../lib/operational-mail';

export const prerender = false;

/** EmDash's own concrete API routes take precedence over this legacy fallback. */
export const ALL: APIRoute = async ({ request, params, locals }) => {
  const path = params.path ?? '';
  const mail = ['v1/leads','v1/abandonos-notify'].includes(path.replace(/\/$/,'')) && locals.emdash
    ? await resolveOperationalMail(env as LegacyBindings,request.url,{email:locals.emdash.email,settings:new OptionsRepository(locals.emdash.db)})
    : undefined;
  return dispatchLegacyApi(request, env as LegacyBindings, path, mail);
};
