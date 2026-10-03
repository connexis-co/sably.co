import type { OperationalMailer, OperationalMessage } from '../../functions/api/v1/_shared';
import { availableOperationalDatabase, type OperationalBindings } from './operational-environment';

interface MailRuntime {
  email: { isAvailable(): boolean; send(message: OperationalMessage, source: string): Promise<void> } | null;
  settings: { get<T>(key: string): Promise<T | null> };
}
/** Use the site's selected provider, never credentials from the legacy bridge. */
export async function resolveOperationalMail(bindings: OperationalBindings, url: string, runtime?: MailRuntime): Promise<OperationalMailer | undefined> {
  if (bindings.SABLY_ENVIRONMENT !== 'production' || !availableOperationalDatabase(bindings,url) || !runtime?.email?.isAvailable()) return undefined;
  let configured: unknown;
  try { configured = await runtime.settings.get('plugin:sably-operations:settings:notificationEmail'); }
  catch { return undefined; }
  if (typeof configured !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(configured.trim())) return undefined;
  const notificationEmail = configured.trim();
  const pipeline = runtime.email;
  return { notificationEmail, send: message => pipeline.send(message,'sably-operations') };
}
