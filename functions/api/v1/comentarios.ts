/**
 * POST /api/v1/comentarios — deja un comentario, que nace en 'pending'.
 *
 * Sin aprobación no entra en v_comment_publico, luego no entra en el snapshot,
 * luego no llega al HTML. La moderación no es un filtro que se pueda olvidar:
 * es el único camino por el que un comentario se vuelve visible.
 */
import {
  type Env, error, hashIp, ipDe, json, paisDe,
  registrarConsentimiento, superaLimite, ulid, verificarTurnstile,
} from './_shared';

interface Cuerpo {
  subject?: string;
  author_name?: string;
  author_email?: string;
  body?: string;
  parent_id?: string;
  turnstile_token?: string;
  consent_text?: string;
}

/** Señales baratas de spam. No decide, solo prioriza la cola de moderación. */
function puntuarSpam(texto: string, nombre: string): number {
  let s = 0;
  const enlaces = (texto.match(/https?:\/\//g) ?? []).length;
  s += Math.min(enlaces * 0.3, 0.6);
  if (/\b(viagra|casino|crypto|bitcoin|loan|porn|xxx)\b/i.test(texto)) s += 0.4;
  if (texto === texto.toUpperCase() && texto.length > 40) s += 0.2;
  if (/(.)\1{6,}/.test(texto)) s += 0.2;
  if (/https?:\/\//.test(nombre)) s += 0.4;
  return Math.min(s, 1);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }

  const nombre = (b.author_name ?? '').trim();
  const texto = (b.body ?? '').trim();
  if (!b.subject || !nombre || !texto) return error('faltan subject, author_name o body');
  if (nombre.length < 2 || nombre.length > 60) return error('el nombre debe tener entre 2 y 60 caracteres');
  if (texto.length < 10 || texto.length > 1200) return error('el comentario debe tener entre 10 y 1200 caracteres');
  if (!b.consent_text) return error('falta la autorización de tratamiento de datos');

  const ip = ipDe(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  if (!(await verificarTurnstile(b.turnstile_token, env.TURNSTILE_SECRET, ip))) {
    return error('no se pudo verificar que eres una persona', 403);
  }
  if (await superaLimite(env.DB, 'comment', ipHash, 5)) {
    return error('demasiados comentarios desde esta conexión, prueba más tarde', 429);
  }

  const pais = paisDe(request);
  const consentId = await registrarConsentimiento(env.DB, 'comment', ipHash, pais, b.consent_text);

  const id = ulid();
  // 90 días de conservación para el correo del autor, que nunca se publica.
  const purga = Math.floor(Date.now() / 1000) + 90 * 24 * 3600;

  try {
    await env.DB.prepare(
      `INSERT INTO comment
         (id, subject_id, parent_id, author_name, author_email, body,
          spam_score, turnstile, consent_id, visitor_id, ip_hash, country, purge_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pass', ?, ?, ?, ?, ?)`,
    )
      .bind(id, b.subject, b.parent_id ?? null, nombre, b.author_email ?? null, texto,
            puntuarSpam(texto, nombre), consentId, null, ipHash, pais, purga)
      .run();
  } catch (e) {
    return error(`no se pudo guardar el comentario: ${(e as Error).message}`, 422);
  }

  return json({ ok: true, estado: 'pendiente_de_moderacion' }, 201);
};

/** GET /api/v1/comentarios?subject=… — solo los aprobados, sin el correo. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const subject = new URL(request.url).searchParams.get('subject');
  if (!subject) return error('falta el parámetro subject');
  const { results } = await env.DB.prepare(
    `SELECT id, parent_id, author_name, body, country, created_at
       FROM v_comment_publico WHERE subject_id = ? LIMIT 200`,
  )
    .bind(subject)
    .all();
  return json({ comentarios: results ?? [] });
};
