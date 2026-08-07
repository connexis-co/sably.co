/**
 * POST /api/v1/leads — sustituye el PUBLIC_LEADS_ENDPOINT que estaba vacío.
 *
 * Es el dato de menor riesgo porque no se publica en ninguna parte, así que
 * es el primero que conviene poner en producción para validar la tubería.
 */
import {
  type Env, error, hashIp, ipDe, json, paisDe,
  registrarConsentimiento, superaLimite, ulid, verificarTurnstile,
} from './_shared';

interface Cuerpo {
  name?: string;
  email?: string;
  phone?: string;
  course_interest?: string;
  source?: string;
  turnstile_token?: string;
  consent_text?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }

  const nombre = (b.name ?? '').trim();
  const email = (b.email ?? '').trim().toLowerCase();
  if (nombre.length < 2 || nombre.length > 80) return error('nombre inválido');
  if (!EMAIL.test(email)) return error('correo inválido');
  if (!b.consent_text) return error('falta la autorización de tratamiento de datos');

  const ip = ipDe(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  if (!(await verificarTurnstile(b.turnstile_token, env.TURNSTILE_SECRET, ip))) {
    return error('no se pudo verificar que eres una persona', 403);
  }
  if (await superaLimite(env.DB, 'lead', ipHash, 10)) {
    return error('demasiados envíos desde esta conexión', 429);
  }

  const pais = paisDe(request);
  const consentId = await registrarConsentimiento(env.DB, 'lead', ipHash, pais, b.consent_text);
  // Dos años de conservación comercial; después lo purga el cron.
  const purga = Math.floor(Date.now() / 1000) + 730 * 24 * 3600;

  try {
    await env.DB.prepare(
      `INSERT INTO lead (id, name, email, phone, course_interest, country,
                         source, consent_id, turnstile, ip_hash, purge_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pass', ?, ?)`,
    )
      .bind(ulid(), nombre, email, b.phone ?? null, b.course_interest ?? null,
            pais, b.source ?? null, consentId, ipHash, purga)
      .run();
  } catch (e) {
    // El índice único (email, curso, día) hace idempotente el doble clic.
    if (/UNIQUE/i.test((e as Error).message)) return json({ ok: true, duplicado: true });
    return error(`no se pudo registrar: ${(e as Error).message}`, 422);
  }

  return json({ ok: true }, 201);
};
