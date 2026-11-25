/**
 * Cuenta con Google (src/lib/cuenta): flujo OAuth (state, PKCE, id_token), sesión, CSRF, límites,
 * borrado y caché. Sin red: Google se simula con claves RS256 propias y un `fetch` falso.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { SqliteD1Database } from '../src/lib/node/d1-sqlite.ts';
import { CuentaAlmacen, desafioPkce, type IdentidadGoogle } from '../src/lib/cuenta/almacen.ts';
import { canjearGoogle, identidadComprobada, urlGoogle, verificarIdToken } from '../src/lib/cuenta/google.ts';
import { DIA, SESION_SEGUNDOS, destinoSeguro, enlaceIngresar, iniciales, resumen, tokenAleatorio, RUTA_PRIVADA, CONSENTIMIENTO } from '../src/lib/cuenta/nucleo.ts';
import { COOKIE_PISTA, leerFormulario, postValido, tokenCsrf } from '../src/lib/cuenta/http.ts';
import { leerEstadoCuenta } from '../src/lib/cuenta/ajustes.ts';
import { canCachePublicPage, sharedPublicRequest } from '../src/lib/public-delivery.ts';

const SECRETO = 'x'.repeat(48);
const ESQUEMA = readFileSync(new URL('../migrations/0011_cuenta.sql', import.meta.url), 'utf8');
const CLIENTE = { id: 'cliente-123.apps.googleusercontent.com', secreto: 'no-es-un-secreto', retorno: 'https://sably.co/ingresar/google/retorno/' };
const T0 = 1_800_000_000;
const CONSENT = { ...CONSENTIMIENTO, ip: '203.0.113.7' };

async function almacen() {
  const db = new SqliteD1Database(':memory:');
  const a = new CuentaAlmacen(db as unknown as D1Database, SECRETO, ESQUEMA);
  await a.asegurarEsquema();
  await a.asegurarEsquema(); // idempotente
  return { db, a };
}
const cuenta = (o: Partial<IdentidadGoogle> = {}): IdentidadGoogle => ({ email: 'ana@gmail.com', sub: 'g-1', nombre: 'Ana Pérez', foto: null, autoritativo: true, ...o });
const contar = (db: SqliteD1Database, tabla: string) => Number(db.database.prepare(`SELECT count(*) AS n FROM ${tabla}`).get()!.n);

// ---------- Google simulado ----------
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] });
async function idToken(claims: Record<string, unknown> = {}, opciones: { aud?: string; iss?: string; exp?: number; iat?: number } = {}) {
  const ahora = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: 'ana@gmail.com', email_verified: true, nonce: 'n-1', name: 'Ana Pérez', picture: 'https://lh3.googleusercontent.com/a/foto', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('g-1').setAudience(opciones.aud ?? CLIENTE.id).setIssuer(opciones.iss ?? 'https://accounts.google.com')
    .setIssuedAt(opciones.iat ?? ahora).setExpirationTime(opciones.exp ?? ahora + 3600)
    .sign(privateKey);
}

test('el esquema de la migración crea todas las tablas de la cuenta', async () => {
  const { db } = await almacen();
  const tablas = db.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'account%' ORDER BY name").all().map(r => r.name);
  assert.deepEqual(tablas, ['account_consents', 'account_identities', 'account_oauth', 'account_prefs', 'account_profiles', 'account_rates', 'account_saves', 'account_sessions', 'accounts']);
});

test('PKCE S256 coincide con el ejemplo del RFC 7636', () => {
  assert.equal(desafioPkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('la URL de Google lleva código, PKCE S256, state, nonce y el retorno exacto', () => {
  const url = new URL(urlGoogle(CLIENTE, { state: 's', nonce: 'n', verifier: 'v'.repeat(64) }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), desafioPkce('v'.repeat(64)));
  assert.equal(url.searchParams.get('redirect_uri'), CLIENTE.retorno);
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('state'), 's');
  assert.equal(url.searchParams.get('nonce'), 'n');
});

test('state: un solo uso, del mismo navegador, igual y a tiempo', async () => {
  const { a, db } = await almacen();
  const flujo = tokenAleatorio();
  const { state, verifier } = await a.iniciarGoogle(flujo, T0);
  assert.equal(contar(db, 'account_oauth'), 1);
  assert.equal(db.database.prepare('SELECT count(*) AS n FROM account_oauth WHERE state = ?').get(state)!.n, 0, 'el state no se guarda en claro');
  assert.equal(await a.consumirGoogle(flujo, tokenAleatorio(), T0 + 1), null, 'state inválido');
  const otra = await a.iniciarGoogle(flujo, T0);
  assert.equal(await a.consumirGoogle(tokenAleatorio(), otra.state, T0 + 1), null, 'otro navegador (otra cookie flow)');
  const tercera = await a.iniciarGoogle(flujo, T0);
  assert.equal(await a.consumirGoogle(flujo, tercera.state, T0 + 601), null, 'caducado a los 10 minutos');
  const buena = await a.iniciarGoogle(flujo, T0);
  const grant = await a.consumirGoogle(flujo, buena.state, T0 + 5);
  assert.ok(grant && grant.verifier.length >= 43 && grant.nonce);
  assert.notEqual(grant.verifier, verifier, 'cada inicio tiene su verificador');
  assert.equal(await a.consumirGoogle(flujo, buena.state, T0 + 6), null, 'no se puede reutilizar');
  assert.equal(await a.consumirGoogle('', buena.state, T0), null, 'cookie flow ausente');
});

test('id_token válido: identidad con correo verificado, nombre y foto de Google', async () => {
  const id = await verificarIdToken(await idToken(), 'n-1', CLIENTE.id, jwks);
  assert.deepEqual(id, { email: 'ana@gmail.com', sub: 'g-1', nombre: 'Ana Pérez', foto: 'https://lh3.googleusercontent.com/a/foto', autoritativo: true });
});

test('id_token inválido: audiencia, emisor, caducidad, nonce, azp, correo sin verificar o firma ajena', async () => {
  const ahora = Math.floor(Date.now() / 1000);
  const casos: [string, Promise<string>, string?][] = [
    ['audiencia errónea', idToken({}, { aud: 'otro-cliente.apps.googleusercontent.com' })],
    ['emisor ajeno', idToken({}, { iss: 'https://evil.example' })],
    ['caducado', idToken({}, { iat: ahora - 7200, exp: ahora - 3600 })],
    ['emitido hace más de 10 minutos', idToken({}, { iat: ahora - 1200 })],
    ['nonce distinto', idToken({ nonce: 'otro' })],
    ['azp de otro cliente', idToken({ azp: 'otro' })],
    ['correo sin verificar', idToken({ email_verified: false })],
    ['sin correo', idToken({ email: undefined })],
  ];
  for (const [nombre, token] of casos) await assert.rejects(verificarIdToken(await token, 'n-1', CLIENTE.id, jwks), undefined, nombre);
  const ajena = await generateKeyPair('RS256');
  const firmadoAjeno = await new SignJWT({ email: 'ana@gmail.com', email_verified: true, nonce: 'n-1' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('g-1').setAudience(CLIENTE.id).setIssuer('https://accounts.google.com').setIssuedAt().setExpirationTime('1h').sign(ajena.privateKey);
  await assert.rejects(verificarIdToken(firmadoAjeno, 'n-1', CLIENTE.id, jwks), undefined, 'firma de otra clave');
  const hs = await new SignJWT({ email: 'ana@gmail.com', email_verified: true, nonce: 'n-1' }).setProtectedHeader({ alg: 'HS256' })
    .setSubject('g-1').setAudience(CLIENTE.id).setIssuer('https://accounts.google.com').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('k'.repeat(32)));
  await assert.rejects(verificarIdToken(hs, 'n-1', CLIENTE.id, jwks), undefined, 'algoritmo HS256');
});

test('la foto solo se acepta de googleusercontent por https; correo de Workspace es autoritativo', () => {
  const base = { sub: 's', email: 'luz@empresa.co', email_verified: true, nonce: 'n' };
  assert.equal(identidadComprobada({ ...base, picture: 'http://lh3.googleusercontent.com/x' }, 'n', 'c').foto, null);
  assert.equal(identidadComprobada({ ...base, picture: 'https://evil.example/x.png' }, 'n', 'c').foto, null);
  assert.equal(identidadComprobada({ ...base }, 'n', 'c').autoritativo, false);
  assert.equal(identidadComprobada({ ...base, hd: 'empresa.co' }, 'n', 'c').autoritativo, true);
  assert.equal(identidadComprobada({ ...base, name: '<b>Luz</b>\u0007' }, 'n', 'c').nombre, 'bLuz/b');
});

test('el canje manda el verificador PKCE y el retorno; un error de Google no abre sesión', async () => {
  let cuerpo = new URLSearchParams();
  const token = await idToken();
  const falso = (async (_url: string, init: RequestInit) => { cuerpo = init.body as URLSearchParams; return new Response(JSON.stringify({ id_token: token })); }) as unknown as typeof fetch;
  const id = await canjearGoogle(CLIENTE, 'codigo-1', { nonce: 'n-1', verifier: 'ver' }, { fetch: falso, jwks });
  assert.equal(id.email, 'ana@gmail.com');
  assert.equal(cuerpo.get('code_verifier'), 'ver');
  assert.equal(cuerpo.get('redirect_uri'), CLIENTE.retorno);
  assert.equal(cuerpo.get('grant_type'), 'authorization_code');
  const error = (async () => new Response('{"error":"invalid_grant"}', { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(canjearGoogle(CLIENTE, 'x', { nonce: 'n-1', verifier: 'v' }, { fetch: error, jwks }));
  const sinToken = (async () => new Response('{}')) as unknown as typeof fetch;
  await assert.rejects(canjearGoogle(CLIENTE, 'x', { nonce: 'n-1', verifier: 'v' }, { fetch: sinToken, jwks }));
});

test('la primera entrada crea la cuenta con constancia y país; la siguiente entra en la misma', async () => {
  const { a, db } = await almacen();
  const r1 = await a.entrarConGoogle(cuenta(), T0, CONSENT, 'mx');
  assert.ok(r1.ok && r1.nueva);
  const r2 = await a.entrarConGoogle(cuenta({ nombre: 'Ana P.' }), T0 + 10, CONSENT);
  assert.ok(r2.ok && !r2.nueva && r2.cuenta === r1.cuenta);
  assert.equal(contar(db, 'accounts'), 1);
  const constancia = db.database.prepare('SELECT purpose, text_version, text, ip_hash FROM account_consents').get()!;
  assert.equal(constancia.text, CONSENTIMIENTO.texto);
  assert.equal(constancia.ip_hash, resumen(SECRETO, 'ip', '203.0.113.7'), 'la IP se guarda como HMAC, no en claro');
  assert.equal((await a.preferencias(r1.cuenta)).pais, 'mx');
  assert.equal(db.database.prepare('SELECT name FROM account_identities').get()!.name, 'Ana P.', 'el nombre se actualiza al entrar');
  assert.equal(db.database.prepare('SELECT count(*) AS n FROM account_sessions WHERE token = ?').get(r1.ok ? r1.token : '')!.n, 0, 'el token de sesión no se guarda en claro');
});

test('una sola cuenta por correo: Gmail se enlaza, un correo no autoritativo no se mezcla, una cuenta bloqueada no entra', async () => {
  const { a, db } = await almacen();
  const r1 = await a.entrarConGoogle(cuenta(), T0, CONSENT);
  const r2 = await a.entrarConGoogle(cuenta({ sub: 'g-2' }), T0, CONSENT);
  assert.ok(r1.ok && r2.ok && r2.cuenta === r1.cuenta);
  assert.equal(contar(db, 'account_identities'), 2);
  await a.entrarConGoogle(cuenta({ email: 'luz@empresa.co', sub: 'w-1', autoritativo: false }), T0, CONSENT);
  assert.deepEqual(await a.entrarConGoogle(cuenta({ email: 'luz@empresa.co', sub: 'w-2', autoritativo: false }), T0, CONSENT), { ok: false, aviso: 'google-otra' });
  db.database.prepare("UPDATE accounts SET status = 'blocked' WHERE email = 'ana@gmail.com'").run();
  assert.deepEqual(await a.entrarConGoogle(cuenta(), T0, CONSENT), { ok: false, aviso: 'bloqueada' });
  assert.equal(await a.cuenta(r1.ok ? r1.token : '', T0 + 1), null, 'la sesión de una cuenta bloqueada deja de valer');
});

test('sesión: 30 días deslizantes con tope de 90; caducada, revocada o ausente no vale', async () => {
  const { a } = await almacen();
  const r = await a.entrarConGoogle(cuenta(), T0, CONSENT);
  assert.ok(r.ok);
  assert.equal(await a.cuenta('', T0), null, 'cookie ausente');
  assert.equal(await a.cuenta(tokenAleatorio(), T0), null, 'token desconocido');
  const c1 = await a.cuenta(r.token, T0 + 1);
  assert.ok(c1 && !c1.renovada && c1.email === 'ana@gmail.com' && c1.nombre === 'Ana Pérez');
  const c2 = await a.cuenta(r.token, T0 + 20 * DIA);
  assert.ok(c2?.renovada && c2.quedan === SESION_SEGUNDOS, 'renueva a 30 días cuando quedan menos de 15');
  for (const dia of [40, 60, 80, 89]) assert.ok(await a.cuenta(r.token, T0 + dia * DIA), `viva el día ${dia}`);
  assert.equal(await a.cuenta(r.token, T0 + 90 * DIA), null, 'nunca pasa de 90 días desde que empezó');
  const r2 = await a.entrarConGoogle(cuenta(), T0, CONSENT);
  assert.ok(r2.ok);
  await a.revocar(r2.token);
  assert.equal(await a.cuenta(r2.token, T0 + 1), null, 'cerrar sesión');
  const [x, y] = [await a.entrarConGoogle(cuenta(), T0, CONSENT), await a.entrarConGoogle(cuenta(), T0, CONSENT)];
  assert.ok(x.ok && y.ok);
  await a.revocarTodas(x.cuenta);
  assert.equal(await a.cuenta(x.token, T0 + 1), null);
  assert.equal(await a.cuenta(y.token, T0 + 1), null, 'cerrar en todos los dispositivos');
});

test('borrar la cuenta borra en cascada todo lo suyo', async () => {
  const { a, db } = await almacen();
  const r = await a.entrarConGoogle(cuenta(), T0, CONSENT, 'co');
  assert.ok(r.ok);
  await a.guardar(r.cuenta, 'curso:curso-de-unas', T0);
  await a.borrarCuenta(r.cuenta);
  for (const tabla of ['accounts', 'account_identities', 'account_profiles', 'account_sessions', 'account_saves', 'account_prefs', 'account_consents']) assert.equal(contar(db, tabla), 0, tabla);
  assert.equal(await a.cuenta(r.token, T0 + 1), null);
});

test('preferencias y guardados', async () => {
  const { a } = await almacen();
  const r = await a.entrarConGoogle(cuenta(), T0, CONSENT);
  assert.ok(r.ok);
  assert.deepEqual(await a.preferencias(r.cuenta), { v: 1 });
  await a.guardarPais(r.cuenta, 'pe', T0);
  assert.equal((await a.preferencias(r.cuenta)).pais, 'pe');
  await a.guardarPais(r.cuenta, null, T0);
  assert.equal((await a.preferencias(r.cuenta)).pais, undefined);
  await a.guardar(r.cuenta, 'curso:a', T0); await a.guardar(r.cuenta, 'curso:a', T0); await a.guardar(r.cuenta, 'curso:b', T0 + 1);
  assert.deepEqual(await a.guardados(r.cuenta), ['curso:b', 'curso:a']);
  await a.quitar(r.cuenta, 'curso:a');
  assert.deepEqual(await a.guardados(r.cuenta), ['curso:b']);
});

test('límite de intentos de inicio por IP y por hora', async () => {
  const { a } = await almacen();
  for (let i = 0; i < 30; i++) assert.ok(await a.permitirInicio('198.51.100.1', T0 + i));
  assert.equal(await a.permitirInicio('198.51.100.1', T0 + 40), false);
  assert.ok(await a.permitirInicio('198.51.100.2', T0 + 40), 'otra IP sigue');
  assert.ok(await a.permitirInicio('198.51.100.1', T0 + 3600), 'una hora después vuelve a dejar');
});

// ---------- HTTP: CSRF, formularios, retornos ----------
function contexto(opciones: { metodo?: string; origen?: string | null; cookies?: Record<string, string>; sitio?: string } = {}) {
  const jar = new Map(Object.entries(opciones.cookies ?? {}));
  const escritas = new Map<string, { value: string; opts: Record<string, unknown> }>();
  const headers = new Headers();
  if (opciones.origen !== null) headers.set('origin', opciones.origen ?? 'https://sably.co');
  if (opciones.sitio) headers.set('sec-fetch-site', opciones.sitio);
  return {
    url: new URL('https://sably.co/ingresar/google/inicio/'),
    request: new Request('https://sably.co/ingresar/google/inicio/', { method: opciones.metodo ?? 'POST', headers }),
    locals: {} as App.Locals,
    escritas,
    cookies: {
      get: (n: string) => (jar.has(n) ? { value: jar.get(n)! } : undefined),
      set: (n: string, value: string, opts: Record<string, unknown>) => { jar.set(n, value); escritas.set(n, { value, opts }); },
    },
  } as never as Parameters<typeof postValido>[0] & { escritas: typeof escritas };
}

test('CSRF: token de la cookie flow, mismo origen y POST; cualquier otra cosa se rechaza', () => {
  const ctx = contexto({ cookies: {} });
  const csrf = tokenCsrf(ctx, SECRETO);
  const flujo = ctx.escritas.get('__Host-sably-flow');
  assert.ok(flujo, 'crea la cookie flow');
  assert.deepEqual({ ...flujo.opts }, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1800 });
  const form = (valor: string) => { const f = new FormData(); f.set('csrf', valor); return f; };
  const cookies = { '__Host-sably-flow': flujo.value };
  assert.equal(postValido(contexto({ cookies }), SECRETO, form(csrf)), true);
  assert.equal(postValido(contexto({ cookies }), SECRETO, form('a'.repeat(64))), false, 'token falso');
  assert.equal(postValido(contexto({ cookies }), SECRETO, form('')), false, 'sin token');
  assert.equal(postValido(contexto({}), SECRETO, form(csrf)), false, 'cookie flow ausente');
  assert.equal(postValido(contexto({ cookies: { '__Host-sably-flow': tokenAleatorio() } }), SECRETO, form(csrf)), false, 'flow de otro navegador');
  assert.equal(postValido(contexto({ cookies, origen: 'https://evil.example' }), SECRETO, form(csrf)), false, 'otro origen');
  assert.equal(postValido(contexto({ cookies, origen: null }), SECRETO, form(csrf)), false, 'sin Origin ni Sec-Fetch-Site');
  assert.equal(postValido(contexto({ cookies, origen: null, sitio: 'same-origin' }), SECRETO, form(csrf)), true, 'sin Origin pero same-origin');
  assert.equal(postValido(contexto({ cookies, metodo: 'GET' }), SECRETO, form(csrf)), false, 'GET');
});

test('formularios: solo urlencoded y como mucho 4 KiB', async () => {
  const pedir = (cuerpo: string, tipo = 'application/x-www-form-urlencoded') => new Request('https://sably.co/x/', { method: 'POST', headers: { 'content-type': tipo }, body: cuerpo });
  assert.equal((await leerFormulario(pedir('csrf=a&volver=%2Fco%2F')))?.get('volver'), '/co/');
  assert.equal(await leerFormulario(pedir('{"csrf":"a"}', 'application/json')), null);
  assert.equal(await leerFormulario(pedir(`x=${'a'.repeat(5000)}`)), null);
});

test('retornos: solo rutas internas del sitio; lo demás va a Mi cuenta', () => {
  for (const ok of ['/', '/co/', '/co/curso-de-unas/', '/mx/cursos/belleza/', '/blog/una-guia/', '/mi-cuenta/']) assert.equal(destinoSeguro(ok), ok, ok);
  for (const malo of ['//evil.example/', 'https://evil.example/', '/\\evil.example/', '/co', '/co/?x=1', '/CO/', '/ingresar/', '/ingresar/google/inicio/', '/api/cuenta/yo/', '/admin/', '/_emdash/admin/', '/mi-cuenta/salir/', 'javascript:alert(1)', '', null, `/${'a'.repeat(250)}/`])
    assert.equal(destinoSeguro(malo as string), '/mi-cuenta/', String(malo));
  assert.equal(enlaceIngresar('/co/curso-de-unas/', 'google'), '/ingresar/?volver=%2Fco%2Fcurso-de-unas%2F&aviso=google');
  assert.equal(enlaceIngresar('https://evil.example/'), '/ingresar/');
  assert.equal(iniciales('Ana María Pérez', 'x@y.co'), 'AP');
  assert.equal(iniciales('', 'luz@y.co'), 'LU');
});

test('caché: las rutas de cuenta nunca se guardan y las cookies de la cuenta no rompen la caché pública', () => {
  for (const ruta of ['/ingresar/', '/ingresar/google/retorno/', '/mi-cuenta/', '/mi-cuenta/salir/', '/api/cuenta/yo']) {
    assert.ok(RUTA_PRIVADA.test(ruta), ruta);
    assert.equal(canCachePublicPage(new Request(`https://sably.co${ruta}`), 'production'), false, ruta);
  }
  assert.equal(canCachePublicPage(new Request('https://sably.co/co/curso-de-unas/'), 'production'), true);
  // Con sesión, una página pública se sirve de la misma copia compartida (sin Vary: Cookie).
  const conSesion = new Request('https://sably.co/co/curso-de-unas/', { headers: { cookie: `__Host-sably-session=${tokenAleatorio()}; ${COOKIE_PISTA}=1; _ga=GA1.1.1` } });
  const compartida = sharedPublicRequest(conSesion, 'production');
  assert.ok(compartida, 'la cookie de sesión no cuenta como cookie personal de EmDash');
  assert.equal(compartida.headers.has('cookie'), false);
  assert.equal(sharedPublicRequest(new Request('https://sably.co/mi-cuenta/', { headers: { cookie: `${COOKIE_PISTA}=1` } }), 'production'), null);
});

test('interruptores: encendidos de fábrica, pero sin clave o sin cliente de Google no hay cuenta', () => {
  const entorno = { SABLY_AUTH_SECRET: SECRETO, SABLY_GOOGLE_ID: 'id', SABLY_GOOGLE_SECRET: 's' };
  const fila = (clave: string, valor: boolean | string) => ({ name: `plugin:sably-operations:settings:${clave}`, value: JSON.stringify(valor) });
  assert.deepEqual(leerEstadoCuenta([], entorno), { activa: true, google: true, disponible: true, acceso: 'ventana' });
  assert.deepEqual(leerEstadoCuenta([fila('cuentaActiva', false)], entorno), { activa: false, google: false, disponible: false, acceso: 'ventana' });
  assert.deepEqual(leerEstadoCuenta([fila('cuentaGoogle', false)], entorno), { activa: true, google: false, disponible: false, acceso: 'ventana' });
  assert.equal(leerEstadoCuenta([{ name: 'plugin:sably-operations:settings:cuentaAcceso', value: '"pagina"' }], entorno).acceso, 'pagina');
  assert.equal(leerEstadoCuenta([], {}).disponible, false, 'producción hoy: sin variables, nada cambia');
  assert.equal(leerEstadoCuenta([], { ...entorno, SABLY_AUTH_SECRET: 'corta' }).disponible, false);
  assert.equal(leerEstadoCuenta([], { ...entorno, SABLY_GOOGLE_SECRET: '' }).disponible, false);
});
