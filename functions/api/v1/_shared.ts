/**
 * Utilidades comunes de la API. Van en Pages Functions y no en un Worker
 * aparte para que compartan origen con sably.co: sin CORS, sin preflight y
 * sin un dominio más que mantener.
 */

export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET?: string;
  SNAPSHOT_TOKEN?: string;
  IP_SALT?: string;
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Ninguna respuesta de la API se cachea: son datos por visitante.
      'cache-control': 'no-store',
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
 * Verifica el token de Turnstile. Si no hay secreto configurado devuelve
 * false en lugar de true: un despliegue sin configurar debe rechazar envíos,
 * no aceptarlos todos.
 */
export async function verificarTurnstile(
  token: string | undefined,
  secret: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!secret || !token) return false;
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

/** Límite por IP y ventana, contando sobre la propia tabla destino. */
export async function superaLimite(
  db: D1Database,
  tabla: 'comment' | 'lead' | 'vote',
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
