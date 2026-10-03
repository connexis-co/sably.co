/** Shared boundary for the public API bridge and authenticated EmDash operations. */
export interface OperationalBindings {
  DB?: D1Database;
  SABLY_DB?: D1Database;
  SABLY_ENVIRONMENT?: string;
  SABLY_CMS_READY?: string;
  SABLY_PRODUCTION_ACTIVATED?: string;
}

export function operationalEnvironmentEnabled(bindings: OperationalBindings, requestUrl: string): boolean {
  let hostname: string;
  try { hostname = new URL(requestUrl).hostname; } catch { return false; }
  const productionHost = hostname === 'sably.co' || hostname === 'www.sably.co';
  if (bindings.SABLY_ENVIRONMENT === 'production') {
    return productionHost && bindings.SABLY_CMS_READY === 'true' && bindings.SABLY_PRODUCTION_ACTIVATED === 'true';
  }
  return bindings.SABLY_ENVIRONMENT === 'development' && !productionHost;
}

export function isolatedOperationalDatabase(bindings: OperationalBindings): D1Database | null {
  const db = bindings.SABLY_DB;
  return db && typeof db.prepare === 'function' && typeof db.batch === 'function' && db !== bindings.DB ? db : null;
}

export function availableOperationalDatabase(bindings: OperationalBindings, requestUrl: string): D1Database | null {
  return operationalEnvironmentEnabled(bindings, requestUrl) ? isolatedOperationalDatabase(bindings) : null;
}
