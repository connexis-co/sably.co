import type { Env as LegacyEnv, OperationalMailer } from '../../functions/api/v1/_shared';
import * as config from '../../functions/api/v1/config';
import * as promo from '../plugins/sably-operations/public';
import * as precios from '../../functions/api/v1/precios/index';
import * as pulso from '../../functions/api/v1/pulso';
import * as comentarios from '../../functions/api/v1/comentarios';
import * as comentarioVoto from '../../functions/api/v1/comentario-voto';
import * as votos from '../../functions/api/v1/votos';
import * as valorar from '../../functions/api/v1/valorar';
import * as leads from '../../functions/api/v1/leads';
import * as snapshot from '../../functions/api/v1/snapshot';
import * as subjects from '../../functions/api/v1/subjects';
import * as ventas from '../../functions/api/v1/ventas';
import * as hotmartWebhook from '../../functions/api/hotmart-webhook.js';
import * as abandonosNotify from '../../functions/api/v1/abandonos-notify';
import * as preciosRefresca from '../../functions/api/v1/precios/refresca';
import { isolatedOperationalDatabase, operationalEnvironmentEnabled, type OperationalBindings } from './operational-environment';
import { PUBLIC_DATA_BROWSER, PUBLIC_DATA_EDGE } from './public-delivery';

/** DB belongs to EmDash. Only SABLY_DB may be passed to the legacy handlers. */
export interface LegacyBindings extends OperationalBindings {
  SABLY_TURNSTILE_SECRET?: string;
  SABLY_SNAPSHOT_TOKEN?: string;
  SABLY_IP_SALT?: string;
  SABLY_HOTMART_HOTTOK?: string;
  SABLY_RESEND_API_KEY?: string;
  SABLY_BREVO_API_KEY?: string;
  SABLY_NOTIFY_EMAIL?: string;
  SABLY_NOTIFY_FROM?: string;
  SABLY_META_CAPI_TOKEN?: string;
  SABLY_META_CAPI_PIXEL_ID?: string;
  SABLY_META_TEST_EVENT_CODE?: string;
  SABLY_GA4_API_SECRET?: string;
  SABLY_GA4_MEASUREMENT_ID?: string;
}

interface BridgeEnv extends LegacyEnv {
  HOTMART_HOTTOK?: string;
  META_CAPI_TOKEN?: string;
  META_CAPI_PIXEL_ID?: string;
  META_TEST_EVENT_CODE?: string;
  GA4_API_SECRET?: string;
  GA4_MEASUREMENT_ID?: string;
}

type Method = 'GET' | 'POST';
type Route = Partial<Record<Method, PagesFunction<BridgeEnv>>>;

// Explicit registry: adding another Pages Function does not expose it in EmDash.
// Every handler below consumes only request and env, not Pages middleware/ASSETS.
const routes: Record<string, Route> = {
  'v1/config': { GET: config.onRequestGet },
  'v1/promo': { GET: promo.onRequestGet },
  'v1/precios': { GET: precios.onRequestGet, POST: precios.onRequestPost },
  'v1/pulso': { GET: pulso.onRequestGet },
  'v1/comentarios': { GET: comentarios.onRequestGet, POST: comentarios.onRequestPost },
  'v1/comentario-voto': { POST: comentarioVoto.onRequestPost },
  'v1/votos': { POST: votos.onRequestPost },
  'v1/valorar': { POST: valorar.onRequestPost },
  'v1/leads': { POST: leads.onRequestPost },
  'v1/snapshot': { GET: snapshot.onRequestGet },
  'v1/subjects': { POST: subjects.onRequestPost },
  'v1/ventas': { GET: ventas.onRequestGet },
};

const productionRoutes: Record<string, Route> = {
  'hotmart-webhook': { GET: hotmartWebhook.onRequestGet, POST: hotmartWebhook.onRequestPost },
  'v1/abandonos-notify': { GET: abandonosNotify.onRequestGet },
  'v1/precios/refresca': { POST: preciosRefresca.onRequestPost },
};

function failure(error: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error }, { status, headers });
}

/** Global, anonymous reads requested by every page; promotions and widget edits purge them. */
const PUBLIC_DATA_ROUTES = new Set(['v1/config', 'v1/promo']);

function apiResponse(response: Response, environment: string, head = false, shared = false): Response {
  const headers = new Headers(response.headers);
  headers.set('x-robots-tag', 'noindex, nofollow');
  headers.set('cache-control', shared ? PUBLIC_DATA_BROWSER : 'no-store');
  if (shared) headers.set('cloudflare-cdn-cache-control', PUBLIC_DATA_EDGE);
  headers.set('x-sably-environment', environment);
  return new Response(head ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Development has no mail/marketing integration credentials. Production requires
 * both explicit activation flags, its canonical hostname and a separate DB.
 * Each integration receives only its own allowlisted credentials, never CMS auth.
 */
export async function dispatchLegacyApi(
  request: Request,
  bindings: LegacyBindings,
  path: string,
  mail?: OperationalMailer,
): Promise<Response> {
  const head = request.method === 'HEAD';
  const environment = bindings.SABLY_ENVIRONMENT;
  const production = environment === 'production';
  const respond = (response: Response, shared = false) => apiResponse(response, environment ?? 'unconfigured', head, shared);
  if (!operationalEnvironmentEnabled(bindings, request.url)) {
    return respond(failure('La API no está habilitada para este entorno.', 503));
  }

  const routePath = path.replace(/^\/+|\/+$/g, '');
  if (!production && Object.hasOwn(productionRoutes, routePath)) {
    return respond(failure('Integración externa deshabilitada en desarrollo; no se ejecutó ninguna acción.', 503));
  }
  const route = Object.hasOwn(routes, routePath) ? routes[routePath]
    : production && Object.hasOwn(productionRoutes, routePath) ? productionRoutes[routePath] : undefined;
  if (!route) return respond(failure('Ruta de API no encontrada.', 404));

  // This legacy GET sends recovery messages. HEAD probes must never execute it.
  const supportsHead = Boolean(route.GET) && routePath !== 'v1/abandonos-notify';
  const method = head ? 'GET' : request.method;
  const handler = head && !supportsHead ? undefined : method === 'GET' || method === 'POST' ? route[method] : undefined;
  if (!handler) {
    const allowed = [...Object.keys(route), ...(supportsHead ? ['HEAD'] : [])].join(', ');
    return respond(failure('Método no permitido.', 405, { allow: allowed }));
  }

  const db = isolatedOperationalDatabase(bindings);
  if (!db) {
    return respond(failure('Falta configurar la base de datos independiente SABLY_DB.', 503));
  }

  // The original webhook treats a missing HOTTOK as public. Fail closed here.
  if (routePath === 'hotmart-webhook' && method === 'POST' && !bindings.SABLY_HOTMART_HOTTOK?.trim()) {
    return respond(failure('Falta configurar la autenticación del webhook.', 503));
  }

  const env: BridgeEnv = {
    DB: db,
    TURNSTILE_SECRET: bindings.SABLY_TURNSTILE_SECRET,
    SNAPSHOT_TOKEN: bindings.SABLY_SNAPSHOT_TOKEN,
    IP_SALT: bindings.SABLY_IP_SALT,
  };
  if (production && (routePath === 'v1/leads' || routePath === 'v1/abandonos-notify')) {
    env.MAIL = mail;
  }
  if (production && routePath === 'hotmart-webhook') {
    env.HOTMART_HOTTOK = bindings.SABLY_HOTMART_HOTTOK;
    env.META_CAPI_TOKEN = bindings.SABLY_META_CAPI_TOKEN;
    env.META_CAPI_PIXEL_ID = bindings.SABLY_META_CAPI_PIXEL_ID;
    env.META_TEST_EVENT_CODE = bindings.SABLY_META_TEST_EVENT_CODE;
    env.GA4_API_SECRET = bindings.SABLY_GA4_API_SECRET;
    env.GA4_MEASUREMENT_ID = bindings.SABLY_GA4_MEASUREMENT_ID;
  }

  try {
    // The registry above contains standalone Pages handlers. No fake next(),
    // ASSETS fetcher or middleware chain is supplied to this compatibility layer.
    const context = { request, env } as Parameters<PagesFunction<BridgeEnv>>[0];
    const response = await handler(context);
    if (!production && routePath === 'v1/leads' && response.ok) {
      const payload = await response.json() as Record<string, unknown>;
      return respond(Response.json({
        ...payload,
        correo: false,
        mensaje: 'Solicitud de prueba guardada. Este entorno no envía correos.',
      }, { status: response.status, headers: response.headers }));
    }
    if (routePath === 'hotmart-webhook' && response.headers.get('content-type')?.includes('application/json')) {
      const payload = await response.json() as Record<string, unknown>;
      // Upstream fetch errors can contain credential-bearing URLs or D1 details.
      if (payload.results && typeof payload.results === 'object') {
        for (const [key, value] of Object.entries(payload.results)) {
          if (typeof value === 'string' && value.startsWith('error:')) (payload.results as Record<string, unknown>)[key] = 'error';
        }
      }
      if (typeof payload.stored === 'string' && payload.stored.startsWith('error:')) payload.stored = 'error';
      return respond(Response.json(payload, { status: response.status, headers: response.headers }));
    }
    return respond(response, method === 'GET' && response.status === 200 && PUBLIC_DATA_ROUTES.has(routePath));
  } catch {
    // Never return database internals, environment values or submitted PII.
    return respond(failure('No se pudo completar la solicitud.', 500));
  }
}
