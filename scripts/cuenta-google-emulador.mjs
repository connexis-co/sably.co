#!/usr/bin/env node
/**
 * Google simulado para probar en local la cuenta de Sably de punta a punta sin el cliente OAuth real.
 * Implementa lo mínimo de OpenID Connect que usa src/lib/cuenta/google.ts: /auth (elige un correo de
 * prueba y vuelve con `code` y `state`), /token (comprueba PKCE S256, cliente y retorno y firma un
 * `id_token` RS256 con el `nonce`) y /certs (JWKS). Solo vale con `astro dev` en localhost:
 *
 *   node scripts/cuenta-google-emulador.mjs --puerto 4399
 *   SABLY_GOOGLE_EMULADOR=http://localhost:4399 SABLY_GOOGLE_ID=emulador SABLY_GOOGLE_SECRET=emulador \
 *   SABLY_AUTH_SECRET=<32+ caracteres> … npx astro dev --port 4327
 */
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const puerto = Number(process.argv[process.argv.indexOf('--puerto') + 1]) || 4399;
const origen = `http://localhost:${puerto}`;
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'emulador', alg: 'RS256', use: 'sig' };
const codigos = new Map();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function leerCuerpo(req) {
  return new Promise(ok => { let d = ''; req.on('data', c => { d += c; }); req.on('end', () => ok(new URLSearchParams(d))); });
}

createServer(async (req, res) => {
  const url = new URL(req.url, origen);
  if (url.pathname === '/certs') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ keys: [jwk] })); }
  if (url.pathname === '/auth') {
    const p = url.searchParams;
    if (p.get('response_type') !== 'code' || p.get('code_challenge_method') !== 'S256' || !p.get('state') || !p.get('nonce')) { res.writeHead(400); return res.end('Petición OIDC incompleta'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Google simulado</title>
      <body style="font:16px system-ui;max-width:420px;margin:48px auto;padding:0 16px">
      <h1 style="font-size:22px">Google simulado (pruebas locales)</h1><p>Cliente: <code>${esc(p.get('client_id'))}</code></p>
      <form method="get" action="/aprobar">${[...p].map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
      <p><label>Correo <input name="correo" value="prueba.sably@gmail.com" style="width:100%"></label></p>
      <p><label>Nombre <input name="nombre" value="Prueba Sably" style="width:100%"></label></p>
      <p><button style="padding:12px 20px">Continuar</button> <button name="cancelar" value="1">Cancelar</button></p></form></body>`);
  }
  if (url.pathname === '/aprobar') {
    const p = url.searchParams;
    const vuelta = new URL(p.get('redirect_uri'));
    vuelta.searchParams.set('state', p.get('state'));
    if (p.get('cancelar')) vuelta.searchParams.set('error', 'access_denied');
    else {
      const code = randomBytes(16).toString('hex');
      codigos.set(code, { cliente: p.get('client_id'), retorno: p.get('redirect_uri'), reto: p.get('code_challenge'), nonce: p.get('nonce'), correo: p.get('correo'), nombre: p.get('nombre') });
      vuelta.searchParams.set('code', code);
    }
    res.writeHead(302, { location: vuelta.href });
    return res.end();
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    const f = await leerCuerpo(req);
    const c = codigos.get(f.get('code'));
    codigos.delete(f.get('code'));
    const reto = createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url');
    if (!c || c.cliente !== f.get('client_id') || c.retorno !== f.get('redirect_uri') || c.reto !== reto || !f.get('client_secret')) {
      res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{"error":"invalid_grant"}');
    }
    const id_token = await new SignJWT({ email: c.correo, email_verified: true, nonce: c.nonce, name: c.nombre, azp: c.cliente })
      .setProtectedHeader({ alg: 'RS256', kid: 'emulador' }).setIssuer(origen).setAudience(c.cliente)
      .setSubject(`emu-${createHash('sha256').update(c.correo).digest('hex').slice(0, 20)}`)
      .setIssuedAt().setExpirationTime('1h').sign(privateKey);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id_token, token_type: 'Bearer', expires_in: 3600 }));
  }
  res.writeHead(404); res.end();
}).listen(puerto, () => console.log(`Google simulado en ${origen}`));
