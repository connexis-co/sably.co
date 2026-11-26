/**
 * Contraseñas de la cuenta (encargo de JP del 26-nov: «el logueo con contraseña también, con correo»).
 *
 * - Hash Argon2id (OWASP: m = 19 MiB, t = 2, p = 1) con `crypto.argon2` de Node (24.7 o más, sin binarios
 *   nativos: va en la imagen node:24 de producción). Donde Node no lo trae (la CI y el desarrollo con
 *   Node 22) se usa scrypt (OWASP: N = 2^17, r = 8, p = 1). El hash dice su algoritmo y sus parámetros, y uno
 *   scrypt se rehace en Argon2id la primera vez que se entra donde Argon2 existe.
 * - Sin reglas de composición (NIST SP 800-63B): de 10 a 128 caracteres, distinta del correo y fuera de las
 *   filtraciones conocidas (Have I Been Pwned por k-anonimato: solo salen los 5 primeros caracteres del SHA-1).
 * - La contraseña nunca se registra ni se guarda: solo su hash.
 */
import * as nodeCrypto from 'node:crypto';

export const CLAVE_MIN = 10;
export const CLAVE_MAX = 128;

type Argon2 = (algoritmo: 'argon2id', p: { message: Uint8Array | string; nonce: Uint8Array; parallelism: number; tagLength: number; memory: number; passes: number },
  cb: (error: Error | null, clave: Buffer) => void) => void;
const argon2 = (nodeCrypto as unknown as { argon2?: Argon2 }).argon2;
export const ARGON2_DISPONIBLE = typeof argon2 === 'function';

const A2 = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 };
const SC = { ln: 17, r: 8, p: 1, largo: 32 };

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/=+$/, '');
const deB64 = (s: string) => Buffer.from(s, 'base64');
const normalizar = (clave: string) => clave.normalize('NFC');

function derivarArgon2(clave: string, sal: Uint8Array, p = A2): Promise<Buffer> {
  return new Promise((ok, mal) => argon2!('argon2id', { message: normalizar(clave), nonce: sal, ...p }, (e, k) => (e ? mal(e) : ok(k))));
}
function derivarScrypt(clave: string, sal: Uint8Array, ln = SC.ln, r = SC.r, p = SC.p, largo = SC.largo): Promise<Buffer> {
  const N = 2 ** ln;
  return new Promise((ok, mal) => nodeCrypto.scrypt(normalizar(clave), sal, largo, { N, r, p, maxmem: 256 * N * r }, (e, k) => (e ? mal(e) : ok(k))));
}

/** Hash autodescrito: `$argon2id$v=19$m=…,t=…,p=…$sal$hash` o `$scrypt$ln=…,r=…,p=…$sal$hash`. */
export async function hashClave(clave: string, usarArgon2 = ARGON2_DISPONIBLE): Promise<string> {
  const sal = nodeCrypto.randomBytes(16);
  if (usarArgon2 && ARGON2_DISPONIBLE) {
    return `$argon2id$v=19$m=${A2.memory},t=${A2.passes},p=${A2.parallelism}$${b64(sal)}$${b64(await derivarArgon2(clave, sal))}`;
  }
  return `$scrypt$ln=${SC.ln},r=${SC.r},p=${SC.p}$${b64(sal)}$${b64(await derivarScrypt(clave, sal))}`;
}

const parametros = (texto: string) => Object.fromEntries(texto.split(',').map(par => { const [k, v] = par.split('='); return [k, Number(v)]; }));

/** Comprueba en tiempo constante. Un hash ilegible o de un algoritmo que este Node no tiene no vale. */
export async function verificarClave(clave: string, hash: string): Promise<boolean> {
  const partes = hash.split('$');
  if (partes.length !== 6 && partes.length !== 5) return false;
  try {
    let esperado: Buffer, calculado: Buffer;
    if (partes[1] === 'argon2id' && partes.length === 6) {
      if (!ARGON2_DISPONIBLE) return false;
      const p = parametros(partes[3]!);
      esperado = deB64(partes[5]!);
      calculado = await derivarArgon2(clave, deB64(partes[4]!), { memory: p.m!, passes: p.t!, parallelism: p.p!, tagLength: esperado.length });
    } else if (partes[1] === 'scrypt' && partes.length === 5) {
      const p = parametros(partes[2]!);
      if (!(p.ln! >= 14 && p.ln! <= 20)) return false;
      esperado = deB64(partes[4]!);
      calculado = await derivarScrypt(clave, deB64(partes[3]!), p.ln, p.r, p.p, esperado.length);
    } else return false;
    return esperado.length === calculado.length && nodeCrypto.timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

/** Hay que rehacerlo si es scrypt y aquí existe Argon2, o si los parámetros de Argon2 cambiaron. */
export function necesitaRehash(hash: string): boolean {
  if (hash.startsWith('$scrypt$')) return ARGON2_DISPONIBLE;
  return !hash.startsWith(`$argon2id$v=19$m=${A2.memory},t=${A2.passes},p=${A2.parallelism}$`);
}

let ficticio: Promise<string> | null = null;
/** Para igualar tiempos cuando el correo no tiene contraseña: se verifica igualmente contra un hash cualquiera. */
export const hashFicticio = () => (ficticio ??= hashClave(b64(nodeCrypto.randomBytes(24))));

export type FalloClave = 'clave-corta' | 'clave-larga' | 'clave-correo';
export function validarClave(clave: string, correo: string): FalloClave | null {
  const largo = [...normalizar(clave)].length;
  if (largo < CLAVE_MIN) return 'clave-corta';
  if (largo > CLAVE_MAX) return 'clave-larga';
  if (correo && normalizar(clave).trim().toLowerCase() === correo.trim().toLowerCase()) return 'clave-correo';
  return null;
}

/**
 * ¿Aparece en filtraciones públicas? Have I Been Pwned (rango de k-anonimato, con relleno): solo viaja el
 * prefijo de 5 caracteres del SHA-1. Si el servicio no responde en 3 s, devuelve null y no se bloquea a nadie.
 */
export async function claveFiltrada(clave: string, pedir: typeof fetch = fetch): Promise<boolean | null> {
  const sha1 = nodeCrypto.createHash('sha1').update(normalizar(clave), 'utf8').digest('hex').toUpperCase();
  const [prefijo, resto] = [sha1.slice(0, 5), sha1.slice(5)];
  try {
    const r = await pedir(`https://api.pwnedpasswords.com/range/${prefijo}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'sably-cuenta' }, signal: AbortSignal.timeout(3_000),
    });
    if (!r.ok) return null;
    for (const linea of (await r.text()).split('\n')) {
      const [sufijo, cuenta] = linea.trim().split(':');
      if (sufijo === resto) return Number(cuenta) > 0; // las líneas de relleno traen 0
    }
    return false;
  } catch {
    return null;
  }
}

/** Revisión completa de una contraseña nueva: forma y filtraciones. Devuelve el aviso o null si vale. */
export async function revisarClaveNueva(clave: string, correo: string, pedir: typeof fetch = fetch): Promise<FalloClave | 'clave-filtrada' | null> {
  const fallo = validarClave(clave, correo);
  if (fallo) return fallo;
  return (await claveFiltrada(clave, pedir)) ? 'clave-filtrada' : null;
}
