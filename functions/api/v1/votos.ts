/**
 * POST /api/v1/votos — voto de 1 a 5 sobre un artículo.
 *
 * UPSERT sobre (subject_id, visitor_id): votar otra vez cambia el voto, no
 * suma uno nuevo. El tiempo mínimo de lectura y el rango del valor los impone
 * la base con CHECK, así que un fallo aquí no puede meter datos inválidos.
 */
import { type Env, error, hashIp, ipDe, json, paisDe, superaLimite } from './_shared';

interface Cuerpo {
  subject?: string;
  value?: number;
  visitor_id?: string;
  dwell_ms?: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }

  const { subject, value, visitor_id: visitante, dwell_ms: dwell } = b;
  if (!subject || !visitante) return error('faltan subject o visitor_id');
  if (typeof value !== 'number' || value < 1 || value > 5) return error('value debe ir de 1 a 5');
  if (typeof dwell !== 'number' || dwell < 3000) return error('voto demasiado rápido', 429);

  const ip = ipDe(request);
  const ipHash = await hashIp(ip, env.IP_SALT);

  if (await superaLimite(env.DB, 'vote', ipHash, 30)) {
    return error('demasiados votos desde esta conexión', 429);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO vote (subject_id, visitor_id, value, ip_hash, country, dwell_ms)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (subject_id, visitor_id)
       DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    )
      .bind(subject, visitante, value, ipHash, paisDe(request), dwell)
      .run();
  } catch (e) {
    // La FK contra subject rechaza slugs que no existen en el catálogo.
    return error(`no se pudo registrar el voto: ${(e as Error).message}`, 422);
  }

  const fila = await env.DB.prepare(
    'SELECT votes, avg_rating FROM v_article_pulse WHERE subject_id = ?',
  )
    .bind(subject)
    .first<{ votes: number; avg_rating: number | null }>();

  return json({ ok: true, votes: fila?.votes ?? 0, avg: fila?.avg_rating ?? null });
};
