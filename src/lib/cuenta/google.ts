/**
 * Acceso con Google: OAuth 2.0 / OpenID Connect con redirección completa,
 * código de autorización, PKCE S256, `state` y `nonce` (contrato §3).
 * El `id_token` se verifica con el JWKS de Google: firma RS256, `aud`, `iss`,
 * `exp`, `nonce`, `azp` y `email_verified`. Sin One Tap ni scripts de Google en
 * las páginas. Referencia: terapiadpareja `reader-providers.ts`.
 *
 * Diferencia con el contrato: el contrato pide `scope=openid email`; aquí se
 * añade `profile` porque «Mi cuenta» enseña el nombre y la foto de Google.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { desafioPkce } from './almacen';
import type { IdentidadGoogle } from './almacen';
import { mismoValor, normalizarCorreo } from './nucleo';

export const EMISORES_GOOGLE = ['https://accounts.google.com', 'accounts.google.com'];
export const PUNTOS_GOOGLE = {
  autorizar: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  certificados: 'https://www.googleapis.com/oauth2/v3/certs',
} as const;
const jwks = new Map<string, JWTVerifyGetKey>();
const claves = (url: string = PUNTOS_GOOGLE.certificados) => {
  let k = jwks.get(url);
  if (!k) { k = createRemoteJWKSet(new URL(url)); jwks.set(url, k); }
  return k;
};

export interface ClienteGoogle {
  id: string;
  secreto: string;
  retorno: string;
  /** Solo en `astro dev` con SABLY_GOOGLE_EMULADOR (scripts/cuenta-google-emulador.mjs): Google simulado. */
  puntos?: { autorizar: string; token: string; certificados: string; emisor: string };
}

export function urlGoogle(cliente: ClienteGoogle, flujo: { state: string; nonce: string; verifier: string }): string {
  const url = new URL(cliente.puntos?.autorizar ?? PUNTOS_GOOGLE.autorizar);
  url.search = new URLSearchParams({
    client_id: cliente.id,
    redirect_uri: cliente.retorno,
    response_type: 'code',
    scope: 'openid email profile',
    state: flujo.state,
    nonce: flujo.nonce,
    code_challenge_method: 'S256',
    code_challenge: desafioPkce(flujo.verifier),
    prompt: 'select_account',
  }).toString();
  return url.href;
}

/** Solo fotos de Google por https; cualquier otra cosa se descarta. */
function fotoSegura(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 500) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && /(?:^|\.)googleusercontent\.com$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

/** Reglas que `jwtVerify` no cubre: correo verificado, `nonce`, `azp` y audiencia múltiple. */
export function identidadComprobada(payload: JWTPayload, nonce: string, cliente: string): IdentidadGoogle {
  const email = normalizarCorreo(typeof payload.email === 'string' ? payload.email : '');
  if (
    !email || payload.email_verified !== true || !payload.sub || payload.sub.length > 255
    || typeof payload.nonce !== 'string' || !mismoValor(payload.nonce, nonce)
    || (payload.azp !== undefined && payload.azp !== cliente)
    || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== cliente)
  ) throw new Error('Identidad sin verificar.');
  const nombre = typeof payload.name === 'string' ? payload.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120) : '';
  return {
    email,
    sub: payload.sub,
    nombre,
    foto: fotoSegura(payload.picture),
    autoritativo: email.endsWith('@gmail.com') || (typeof payload.hd === 'string' && payload.hd.length > 0),
  };
}

/** Verifica un `id_token` de Google (separado del canje para poder probarlo con claves propias). */
export async function verificarIdToken(idToken: string, nonce: string, clienteId: string, llaves: JWTVerifyGetKey = claves(), emisores: string[] = EMISORES_GOOGLE): Promise<IdentidadGoogle> {
  const { payload } = await jwtVerify(idToken, llaves, {
    audience: clienteId,
    issuer: emisores,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'iat', 'exp', 'nonce', 'email'],
    maxTokenAge: '10 minutes',
    clockTolerance: 5,
  });
  return identidadComprobada(payload, nonce, clienteId);
}

/** Canjea el código por el `id_token` (con el verificador PKCE) y lo verifica. */
export async function canjearGoogle(
  cliente: ClienteGoogle, codigo: string, flujo: { nonce: string; verifier: string },
  opciones: { fetch?: typeof fetch; jwks?: JWTVerifyGetKey } = {},
): Promise<IdentidadGoogle> {
  const respuesta = await (opciones.fetch ?? fetch)(cliente.puntos?.token ?? PUNTOS_GOOGLE.token, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cliente.id,
      client_secret: cliente.secreto,
      code: codigo,
      redirect_uri: cliente.retorno,
      code_verifier: flujo.verifier,
    }),
  });
  if (!respuesta.ok) throw new Error('Google no completó el acceso.');
  const token = (await respuesta.json()) as { id_token?: unknown };
  if (typeof token.id_token !== 'string') throw new Error('Falta la verificación de Google.');
  return verificarIdToken(token.id_token, flujo.nonce, cliente.id,
    opciones.jwks ?? claves(cliente.puntos?.certificados), cliente.puntos ? [cliente.puntos.emisor] : EMISORES_GOOGLE);
}
