/**
 * Utilidades comunes de la API. Van en Pages Functions y no en un Worker
 * aparte para que compartan origen con sably.co: sin CORS, sin preflight y
 * sin un dominio más que mantener.
 */

export interface OperationalMessage { to: string; cc?: string[]; replyTo?: string; subject: string; text: string; html?: string; }
export interface OperationalMailer { notificationEmail: string; send(message: OperationalMessage): Promise<void>; }
export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET?: string;
  SNAPSHOT_TOKEN?: string;
  IP_SALT?: string;
  /** Aviso por correo de los leads. Sin estas tres, el lead se guarda igual. */
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  NOTIFY_FROM?: string;
  /** Email marketing/transaccional. Si está, tiene prioridad sobre Resend. */
  BREVO_API_KEY?: string;
  /** Injected official EmDash email pipeline; never populated in development. */
  MAIL?: OperationalMailer;
}

/**
 * Monedas que el checkout de Hotmart puede mostrar de verdad en nuestros
 * mercados. El payload del checkout se lee con un regex de pares
 * `numero,"XXX"`, y CUALQUIER trigrama en mayúsculas pasaba por moneda: el
 * checkout de Chile coló `"RUT":19` (el campo del documento chileno, con su
 * IVA al lado) como si fuera una divisa, y acabó horneado en los 102 cursos
 * de hotmart-live.json. Todo punto que escriba precios filtra por esta lista.
 */
export const MONEDAS_ISO: ReadonlySet<string> = new Set([
  'USD', 'COP', 'MXN', 'EUR', 'PEN', 'CLP', 'ARS', 'BRL',
  'UYU', 'PYG', 'BOB', 'GTQ', 'CRC', 'DOP', 'HNL', 'NIO', 'CAD', 'GBP',
]);

/**
 * Fuera del índice todo JSON de la API. Googlebot ejecuta el JS de las fichas,
 * descubre /api/v1/config, /promo o /precios y los rastrea como URLs sueltas
 * que no responden a ninguna búsqueda. public/_headers no se aplica a las
 * Functions, así que la cabecera la pone cada helper que construye la respuesta.
 */
export const SIN_INDICE = { 'x-robots-tag': 'noindex' } as const;

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Ninguna respuesta de la API se cachea: son datos por visitante.
      'cache-control': 'no-store',
      ...SIN_INDICE,
    },
  });

export const error = (mensaje: string, status = 400): Response =>
  json({ error: mensaje }, status);

/**
 * SHA-256(ip + sal + día). Permite exigir IPs distintas y limitar por origen
 * sin llegar a almacenar la IP, que es un dato personal bajo la Ley 1581 y el
 * RGPD. La sal diaria hace que el hash no sea estable entre días, así que
 * tampoco sirve para seguir a nadie en el tiempo.
 */
export async function hashIp(ip: string, salt = ''): Promise<string> {
  const dia = new Date().toISOString().slice(0, 10);
  const datos = new TextEncoder().encode(`${ip}|${salt}|${dia}`);
  const buf = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ULID simplificado: ordenable por tiempo y sin colisiones prácticas. */
export function ulid(): string {
  const t = Date.now().toString(36).padStart(9, '0');
  const r = crypto.getRandomValues(new Uint8Array(10));
  return (t + [...r].map((b) => b.toString(36).padStart(2, '0')).join('')).toUpperCase();
}

/**
 * Verifica el token de Turnstile contra Cloudflare.
 *
 * Devuelve null cuando no hay secreto configurado, que es distinto de false:
 * `false` es «lo comprobé y no pasó», `null` es «no había con qué comprobar».
 * Quien llama decide, y así un despliegue a medias no queda ni abierto de par
 * en par ni rechazando a todo el mundo en silencio.
 */
export async function verificarTurnstile(
  token: string | undefined,
  secret: string | undefined,
  ip: string,
): Promise<boolean | null> {
  if (!secret) return null;
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const d = (await r.json()) as { success?: boolean };
  return d.success === true;
}

export interface Antiabuso {
  /** Si es true, hay que rechazar con 403. */
  rechazar: boolean;
  /** Sospecha de 0 a 1, que se suma a la puntuación de spam del moderador. */
  sospecha: number;
  /** Qué se comprobó, para que el panel no tenga que adivinarlo. */
  turnstile: 'pass' | 'fail';
  motivo: string;
}

/**
 * Defensa que no depende de Turnstile.
 *
 * Turnstile es la barrera buena, pero mientras no esté configurado el sitio no
 * puede quedarse sin formularios. Estas dos señales cuestan cero y filtran el
 * relleno automático de formularios, que es el grueso del abuso:
 *
 *   · **trampa**: un campo que una persona no ve y no puede rellenar. No se
 *     llama «empresa» ni «teléfono» a propósito — el autocompletado de Chrome
 *     y Safari rellena esos aunque lleven autocomplete="off", y entonces la
 *     trampa se cierra sobre gente real.
 *   · **abierto_ms**: cuánto tardó en enviarse desde que se pintó el
 *     formulario. Un guion tarda milisegundos; una persona, segundos.
 *
 * Ninguna de las dos DESCARTA el envío por su cuenta: suben la sospecha y el
 * comentario nace igualmente en la cola de moderación. Descartar en silencio
 * un mensaje de una persona real es peor que revisar uno de más.
 */
export async function evaluarAbuso(
  opciones: {
    turnstileToken?: string;
    trampa?: string;
    abiertoMs?: number;
  },
  secret: string | undefined,
  ip: string,
): Promise<Antiabuso> {
  const veredicto = await verificarTurnstile(opciones.turnstileToken, secret, ip);
  if (veredicto === true) return { rechazar: false, sospecha: 0, turnstile: 'pass', motivo: '' };
  if (veredicto === false) {
    return { rechazar: true, sospecha: 1, turnstile: 'fail', motivo: 'turnstile no superado' };
  }

  // Sin Turnstile configurado: se cae a las señales baratas.
  if (opciones.trampa) {
    return { rechazar: true, sospecha: 1, turnstile: 'fail', motivo: 'campo trampa relleno' };
  }
  const ms = opciones.abiertoMs ?? 0;
  if (ms > 0 && ms < 2500) {
    return { rechazar: true, sospecha: 1, turnstile: 'fail', motivo: 'formulario enviado demasiado rápido' };
  }
  // Que no venga el dato no es motivo de rechazo (un navegador viejo, una
  // extensión), pero sí de mirarlo con más atención en la cola.
  return { rechazar: false, sospecha: ms === 0 ? 0.3 : 0.15, turnstile: 'fail', motivo: '' };
}

/**
 * Límite por IP y ventana, contando sobre la propia tabla destino.
 *
 * El nombre de la tabla se interpola en la SQL, así que la unión literal del
 * tipo es lo único que impide una inyección por ahí. No aceptar `string`.
 */
export async function superaLimite(
  db: D1Database,
  tabla: 'comment' | 'comment_vote' | 'lead' | 'vote',
  ipHash: string,
  maximo: number,
  ventanaSeg = 3600,
): Promise<boolean> {
  const desde = Math.floor(Date.now() / 1000) - ventanaSeg;
  const { count } = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${tabla} WHERE ip_hash = ? AND created_at > ?`)
    .bind(ipHash, desde)
    .first<{ count: number }>() ?? { count: 0 };
  return count >= maximo;
}

/** Registra la autorización con el texto que se mostró, no un booleano. */
export async function registrarConsentimiento(
  db: D1Database,
  purpose: 'lead' | 'comment' | 'review',
  ipHash: string,
  country: string | null,
  textoMostrado: string,
): Promise<string> {
  const id = ulid();
  await db
    .prepare(
      `INSERT INTO consent (id, purpose, policy_version, policy_url, text_shown, ip_hash, country)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, purpose, '2026-08-v1', 'https://sably.co/legal/privacidad/', textoMostrado, ipHash, country)
    .run();
  return id;
}

export const ipDe = (req: Request): string =>
  req.headers.get('cf-connecting-ip') ?? '0.0.0.0';

export const paisDe = (req: Request): string | null =>
  (req as Request & { cf?: { country?: string } }).cf?.country ?? null;
