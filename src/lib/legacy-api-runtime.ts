import { OptionsRepository } from 'emdash';
import type { EmDashRuntime } from 'emdash/middleware';
import type { OperationalMailer } from '../../functions/api/v1/_shared';
import type { LegacyBindings } from './legacy-backend';
import { integrationSettings } from './integration-settings';
import { operationalEnvironmentEnabled } from './operational-environment';
import { resolveOperationalMail } from './operational-mail';
import { resolveIntegrationBindings } from '../plugins/sably-integrations/model';

type Runtime = Pick<EmDashRuntime, 'db' | 'email'>;
export type RuntimeAccess = <T>(run: (runtime: Runtime) => T | Promise<T>) => Promise<T>;
type Bindings = LegacyBindings & { EMDASH_ENCRYPTION_KEY?: string };

const MAIL_ROUTES = new Set(['v1/leads', 'v1/abandonos-notify']);

/**
 * Visitors and Hotmart call the legacy API anonymously, and EmDash gives an
 * anonymous request a reduced `locals.emdash` with neither `db` nor `email`.
 * Read both from the runtime, as EmDash documents for callers without locals.
 */
export async function resolveLegacyApiRuntime(
  path: string,
  bindings: Bindings,
  url: string,
  withRuntime: RuntimeAccess,
): Promise<{ bindings: LegacyBindings; mail?: OperationalMailer }> {
  const route = path.replace(/^\/+|\/+$/g, '');
  const webhook = route === 'hotmart-webhook';
  // Never open the runtime or read credentials for a preview or a non-production domain.
  if (!(webhook || MAIL_ROUTES.has(route)) || bindings.SABLY_ENVIRONMENT !== 'production' || !operationalEnvironmentEnabled(bindings, url)) {
    return { bindings };
  }
  if (webhook) {
    // Fail closed: without its settings the webhook cannot authenticate Hotmart.
    return { bindings: await withRuntime(async runtime => resolveIntegrationBindings(bindings, url, await integrationSettings(runtime.db, bindings))) };
  }
  try {
    return { bindings, mail: await withRuntime(runtime => resolveOperationalMail(bindings, url, { email: runtime.email, settings: new OptionsRepository(runtime.db) })) };
  } catch {
    // A contact is saved even when the team cannot be notified.
    console.error('Sably operational mail is unavailable; the request continues without notifications.');
    return { bindings };
  }
}
