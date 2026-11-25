/**
 * Núcleo puro de la cuenta (contrato común del 25-nov-2026, §3–§4 y §9).
 * Sin Astro ni base de datos: lo usan las rutas, el almacén y las pruebas.
 * Referencia: terapiadpareja.com `web/src/lib/reader-*.ts`, adaptada a Sably.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const DIA = 86_400;
/** Sesión de 30 días deslizantes con tope absoluto de 90 (contrato §4). */
export const SESION_SEGUNDOS = 30 * DIA;
export const SESION_RENOVAR_SI_QUEDAN = 15 * DIA;
export const SESION_TOPE = 90 * DIA;
/** Cookie de flujo (base del CSRF) y del `state` de Google. */
export const FLUJO_SEGUNDOS = 30 * 60;
export const OAUTH_SEGUNDOS = 10 * 60;
export const RETORNO_SEGUNDOS = 10 * 60;

/** Límites por hora del acceso con Google (por IP y del sitio entero). */
export const LIMITE_IP_HORA = 30;
export const LIMITE_TOTAL_HORA = 600;

export const ahora = () => Math.floor(Date.now() / 1000);

/** 32 bytes aleatorios en base64url (43 caracteres). */
export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const bytesAleatorios = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const tokenAleatorio = () => base64url(bytesAleatorios(32));
export const tokenValido = (valor: unknown): valor is string => typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor);

/** HMAC-SHA256(secreto, ámbito \0 valor) en hex: lo único que se guarda de tokens, `state` e IP. */
export function resumen(secreto: string, ambito: string, valor: string): string {
  return createHmac('sha256', secreto).update(`${ambito}\0${valor}`).digest('hex');
}

/** Comparación en tiempo constante (longitudes distintas = distinto, sin atajo por contenido). */
export function mismoValor(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Correo normalizado: minúsculas, recortado, ≤ 254 y con forma de correo; si no, cadena vacía. */
export function normalizarCorreo(valor: string): string {
  const correo = valor.trim().toLowerCase();
  return correo.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/.test(correo) ? correo : '';
}

/** Rutas de la cuenta (contrato §9). */
export const RUTAS = {
  ingresar: '/ingresar/',
  googleInicio: '/ingresar/google/inicio/',
  googleRetorno: '/ingresar/google/retorno/',
  cuenta: '/mi-cuenta/',
  salir: '/mi-cuenta/salir/',
  borrar: '/mi-cuenta/borrar/',
  yo: '/api/cuenta/yo',
  preferencias: '/api/cuenta/preferencias',
  guardados: '/api/cuenta/guardados',
} as const;

/** Rutas privadas: nunca en caché, nunca indexadas, fuera de los sitemaps. */
export const RUTA_PRIVADA = /^\/(?:ingresar|mi-cuenta)(?:\/|$)|^\/api\/cuenta(?:\/|$)/;

/**
 * Lista blanca de retornos: solo una ruta interna de Sably hecha de segmentos
 * en minúsculas con barra final (las URL públicas del sitio), sin consulta, sin
 * `//` y nunca hacia el propio acceso, la API ni el panel. Lo demás → Mi cuenta.
 */
export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor || valor.length > 200) return RUTAS.cuenta;
  if (valor === '/' || valor === RUTAS.cuenta) return valor;
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/.test(valor)) return RUTAS.cuenta;
  if (/^\/(?:ingresar|api|admin|_emdash|mi-cuenta\/(?:salir|borrar))\//.test(valor)) return RUTAS.cuenta;
  return valor;
}

/** Avisos de /ingresar/ (contrato §9) y los de Mi cuenta. */
export const AVISOS: Record<string, string> = {
  google: 'Google no completó el acceso. Vuelve a intentarlo.',
  'google-otra': 'Ese correo ya tiene una cuenta en Sably creada con otra forma de acceso. Entra con la que usaste la primera vez.',
  espera: 'Hubo demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  salida: 'Cerraste la sesión.',
  borrada: 'Tu cuenta y sus datos se borraron de Sably.',
  bloqueada: 'Esta cuenta no puede entrar. Escríbenos si crees que es un error.',
  formulario: 'El formulario caducó. Vuelve a intentarlo.',
  guardado: 'Preferencias guardadas.',
};

/** Enlace a /ingresar/ con su retorno y aviso. */
export function enlaceIngresar(destino?: string | null, aviso?: string): string {
  const ruta = destinoSeguro(destino);
  const params = new URLSearchParams();
  if (ruta !== RUTAS.cuenta) params.set('volver', ruta);
  if (aviso) params.set('aviso', aviso);
  return RUTAS.ingresar + (params.size ? `?${params}` : '');
}

/** Clave estable de un curso guardado (contrato §6). */
export const claveCurso = (slug: string) => `curso:${slug}`;
export const claveGuardadoValida = (item: unknown): item is string => typeof item === 'string' && /^curso:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item) && item.length <= 160;

/** Iniciales para el avatar sin foto. */
export function iniciales(nombre: string, correo: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0] ?? '', ultima = partes[partes.length - 1] ?? '';
  const letras = partes.length >= 2 ? primera.slice(0, 1) + ultima.slice(0, 1) : (primera || correo).slice(0, 2);
  return letras.toLocaleUpperCase('es');
}

/**
 * Texto que se enseña junto al botón de Google y se guarda literal como constancia al crear la cuenta
 * (Ley 1581 de 2012 y RGPD). Si cambia, sube la versión.
 */
export const CONSENTIMIENTO = {
  version: 'cuenta-2026-11-25',
  texto: 'Al continuar creas tu cuenta en Sably o entras en ella. Guardamos tu correo, tu nombre y tu foto de Google para identificarte, recordar tus preferencias y los cursos que guardes. No los usamos para publicidad ni los compartimos. Puedes borrar tu cuenta cuando quieras desde Mi cuenta.',
} as const;
