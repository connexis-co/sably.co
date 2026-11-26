/**
 * Cookies, CSRF, formularios y cabeceras de las rutas de cuenta (contrato §4–§5).
 * Solo lo importan las rutas `/ingresar/`, `/mi-cuenta/` y `/api/cuenta/`:
 * ninguna página pública lee la sesión en el servidor.
 */
import type { APIContext, AstroCookies } from 'astro';
import { CuentaAlmacen, type CuentaActual } from './almacen';
import { entornoCuenta, estadoCuenta, type EstadoCuenta } from './ajustes';
import type { ClienteGoogle } from './google';
import { envioCorreo, type Enviar } from './correo';
import { COUNTRIES } from '../countries';
import { FLUJO_SEGUNDOS, RETORNO_SEGUNDOS, ahora, destinoSeguro, mismoValor, resumen, tokenAleatorio, tokenValido, RUTAS } from './nucleo';

type Contexto = { url: URL; request: Request; cookies: AstroCookies; locals: App.Locals };

export const ORIGEN_PRODUCCION = 'https://sably.co';
/** Cookie pista sin datos (no HttpOnly): solo dice al script de la cabecera que pida /api/cuenta/yo. */
export const COOKIE_PISTA = 'sably_cuenta_ui';

/** `Cache-Control: private, no-store`, `noindex` y sin marcos (contrato §4). */
export const CABECERAS_PRIVADAS: Record<string, string> = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

export function aplicarCabecerasPrivadas(headers: Headers): void {
  for (const [nombre, valor] of Object.entries(CABECERAS_PRIVADAS)) headers.set(nombre, valor);
}

/** En `astro dev` sobre localhost: cookies sin `__Host-` ni `Secure`. */
export function esLocal(url: URL): boolean {
  return !!import.meta.env?.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

const nombreCookie = (url: URL, tipo: 'session' | 'flow' | 'return') => `${esLocal(url) ? 'sably-local-' : '__Host-sably-'}${tipo}`;

function escribir(ctx: Contexto, tipo: 'session' | 'flow' | 'return', valor: string, maxAge: number) {
  ctx.cookies.set(nombreCookie(ctx.url, tipo), valor, { path: '/', httpOnly: true, secure: !esLocal(ctx.url), sameSite: 'lax', maxAge });
}

function pista(ctx: Contexto, maxAge: number) {
  ctx.cookies.set(COOKIE_PISTA, maxAge > 0 ? '1' : '', { path: '/', httpOnly: false, secure: !esLocal(ctx.url), sameSite: 'lax', maxAge });
}

const leer = (ctx: Contexto, tipo: 'session' | 'flow' | 'return') => ctx.cookies.get(nombreCookie(ctx.url, tipo))?.value ?? '';
export const cookieFlujo = (ctx: Contexto) => leer(ctx, 'flow');

let esquemaListo: Promise<void> | null = null;

/** Configuración del servidor y almacén; null si la cuenta está apagada o sin configurar. */
export interface ServidorCuenta {
  estado: EstadoCuenta; almacen: CuentaAlmacen; secreto: string; google: ClienteGoogle | null;
  /** Envío del código por correo, o null si el acceso con correo está apagado o sin proveedor listo. Se calcula una vez. */
  correo: () => Promise<Enviar | null>;
}

export async function cuentaServidor(ctx: Contexto): Promise<ServidorCuenta | null> {
  const estado = await estadoCuenta(ctx.locals);
  if (!estado.disponible) return null;
  const entorno = await entornoCuenta();
  const { env } = await import('virtual:sably-runtime');
  const secreto = entorno.SABLY_AUTH_SECRET!;
  const esquemas = await Promise.all([
    import('../../../migrations/0011_cuenta.sql?raw'), import('../../../migrations/0013_cuenta_codigo.sql?raw'),
    import('../../../migrations/0014_cuenta_contrasena.sql?raw'),
  ]);
  const almacen = new CuentaAlmacen(env.SABLY_DB, secreto, esquemas.map(m => m.default).join(';\n'));
  esquemaListo ??= almacen.asegurarEsquema().catch(error => { esquemaListo = null; throw error; });
  await esquemaListo;
  const origen = esLocal(ctx.url) ? ctx.url.origin : ORIGEN_PRODUCCION;
  const google: ClienteGoogle | null = estado.google ? { id: entorno.SABLY_GOOGLE_ID!, secreto: entorno.SABLY_GOOGLE_SECRET!, retorno: origen + RUTAS.googleRetorno } : null;
  // Google simulado para probar el flujo en local (nunca en producción: `import.meta.env.DEV` es false al compilar).
  const emulador = (env as Record<string, string | undefined>).SABLY_GOOGLE_EMULADOR;
  if (google && import.meta.env?.DEV && esLocal(ctx.url) && emulador && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(emulador)) {
    google.puntos = { autorizar: `${emulador}/auth`, token: `${emulador}/token`, certificados: `${emulador}/certs`, emisor: emulador };
  }
  let envio: Promise<Enviar | null> | null = null;
  const correo = () => (envio ??= estado.correo ? envioCorreo(esLocal(ctx.url), env as Record<string, string | undefined>) : Promise.resolve(null));
  return { estado, almacen, secreto, google, correo };
}

/** Token CSRF derivado de la cookie `flow`; la crea si falta (30 min). */
export function tokenCsrf(ctx: Contexto, secreto: string): string {
  let flujo = cookieFlujo(ctx);
  if (!tokenValido(flujo)) {
    flujo = tokenAleatorio();
    escribir(ctx, 'flow', flujo, FLUJO_SEGUNDOS);
  }
  return resumen(secreto, 'csrf', flujo);
}

/** POST del mismo origen, con la cookie `flow` y su token CSRF. */
export function postValido(ctx: Contexto, secreto: string, formulario: FormData): boolean {
  const flujo = cookieFlujo(ctx);
  const esperado = esLocal(ctx.url) ? ctx.url.origin : ORIGEN_PRODUCCION;
  const h = ctx.request.headers;
  const origen = h.get('origin');
  const mismoOrigen = origen === esperado
    || (origen === null && h.get('sec-fetch-site') === 'same-origin')
    || (origen === 'null' && h.get('sec-fetch-site') === 'same-origin' && h.get('sec-fetch-mode') === 'navigate');
  return ctx.request.method === 'POST' && tokenValido(flujo) && mismoOrigen
    && mismoValor(resumen(secreto, 'csrf', flujo), String(formulario.get('csrf') ?? ''));
}

/** Solo `application/x-www-form-urlencoded` y como mucho 4 KiB (contrato §4). */
export async function leerFormulario(request: Request): Promise<FormData | null> {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return null;
  if (Number(request.headers.get('content-length') ?? 0) > 4096 || !request.body) return null;
  const lector = request.body.getReader();
  const trozos: Uint8Array[] = [];
  let tamano = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      tamano += value.length;
      if (tamano > 4096) { await lector.cancel(); return null; }
      trozos.push(value);
    }
  } finally { lector.releaseLock(); }
  const formulario = new FormData();
  for (const [k, v] of new URLSearchParams(new TextDecoder().decode(Buffer.concat(trozos)))) formulario.append(k, v);
  return formulario;
}

/** Retorno tras Google (10 min): la ruta de vuelta y el país elegido en este dispositivo («co~/co/cursos/»). */
export function recordarRetorno(ctx: Contexto, destino: string, pais = '') {
  escribir(ctx, 'return', `${paisValido(pais) ? pais : ''}~${destinoSeguro(destino)}`, RETORNO_SEGUNDOS);
}
export function tomarRetorno(ctx: Contexto): { destino: string; pais: string } {
  const [pais = '', destino = ''] = leer(ctx, 'return').split('~');
  escribir(ctx, 'return', '', 0);
  return { destino: destinoSeguro(destino), pais: paisValido(pais) ? pais : '' };
}
export const paisValido = (pais: string) => COUNTRIES.some(c => c.code === pais);

/** Cuenta de la sesión; si se renovó, reescribe las cookies con la nueva caducidad. */
export async function cuentaActual(ctx: Contexto, almacen: CuentaAlmacen): Promise<CuentaActual | null> {
  const token = leer(ctx, 'session');
  if (!tokenValido(token)) return null;
  const cuenta = await almacen.cuenta(token, ahora());
  if (!cuenta) { cerrarCookies(ctx); return null; }
  if (cuenta.renovada) { escribir(ctx, 'session', token, cuenta.quedan); pista(ctx, cuenta.quedan); }
  return cuenta;
}

/** Al entrar: revoca la sesión anterior de este navegador, fija la nueva y rota `flow`. */
export async function abrirSesion(ctx: Contexto, almacen: CuentaAlmacen, token: string, segundos: number) {
  const anterior = leer(ctx, 'session');
  if (tokenValido(anterior) && anterior !== token) await almacen.revocar(anterior);
  escribir(ctx, 'session', token, segundos);
  pista(ctx, segundos);
  escribir(ctx, 'flow', tokenAleatorio(), FLUJO_SEGUNDOS);
}

function cerrarCookies(ctx: Contexto) {
  escribir(ctx, 'session', '', 0);
  escribir(ctx, 'flow', '', 0);
  pista(ctx, 0);
}

export async function cerrarSesion(ctx: Contexto, almacen: CuentaAlmacen) {
  const token = leer(ctx, 'session');
  if (tokenValido(token)) await almacen.revocar(token);
  cerrarCookies(ctx);
}

/** Borra cookies sin tocar la base (cuenta apagada o borrada). */
export const olvidarCookies = cerrarCookies;

/** IP que deja nginx (`X-Forwarded-For $remote_addr`, que el vhost de Sably fija desde los rangos de Cloudflare). */
export function ipCliente(request: Request): string {
  return (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim().slice(0, 64) || 'local';
}

export function redirigir(ruta: string, status = 303): Response {
  const headers = new Headers({ Location: ruta });
  aplicarCabecerasPrivadas(headers);
  return new Response(null, { status, headers });
}

export function json(datos: unknown, status = 200): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  aplicarCabecerasPrivadas(headers);
  return new Response(JSON.stringify(datos), { status, headers });
}

export function noEncontrada(): Response {
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  aplicarCabecerasPrivadas(headers);
  return new Response('Not found', { status: 404, headers });
}

export function prohibido(mensaje = 'El formulario caducó. Vuelve a intentarlo.'): Response {
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  aplicarCabecerasPrivadas(headers);
  return new Response(mensaje, { status: 403, headers });
}

export type { Contexto as ContextoCuenta, APIContext };
