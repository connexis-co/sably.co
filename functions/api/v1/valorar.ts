/**
 * POST /api/v1/valorar {slug, rating} — valoración de visitante (1–5).
 *
 * Un voto por visitante y curso (clave slug + hash de IP; votar de nuevo
 * reemplaza). Se guarda aparte de la valoración de compradores de Hotmart:
 * la nota publicada y marcada en JSON-LD sigue siendo la de quienes pagaron.
 *
 * Devuelve el agregado de visitantes para pintar un «gracias» con contexto.
 */
import type { Env } from './_shared';
import { error, hashIp, ipDe, json } from './_shared';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let slug = '';
  let rating = 0;
  try {
    const d = (await request.json()) as { slug?: string; rating?: number };
    slug = String(d.slug ?? '');
    rating = Number(d.rating);
  } catch {
    return error('Cuerpo JSON inválido.');
  }
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return error('Slug inválido.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return error('La nota va de 1 a 5.');

  try {
    // Solo cursos que existen: la tabla de productos ya está sembrada.
    const existe = await env.DB.prepare('SELECT 1 FROM hotmart_producto WHERE slug = ?')
      .bind(slug)
      .first();
    if (!existe) return error('Curso desconocido.', 404);

    const ip = await hashIp(ipDe(request), env.IP_SALT ?? '');
    await env.DB.prepare(
      `INSERT INTO visitor_rating (slug, ip_hash, rating)
       VALUES (?, ?, ?)
       ON CONFLICT(slug, ip_hash) DO UPDATE SET rating = excluded.rating, created_at = unixepoch()`,
    )
      .bind(slug, ip, rating)
      .run();

    const agg = await env.DB.prepare('SELECT votos, media FROM v_visitor_rating WHERE slug = ?')
      .bind(slug)
      .first<{ votos: number; media: number }>();
    return json({ ok: true, votos: agg?.votos ?? 1, media: agg?.media ?? rating });
  } catch (err) {
    console.error('valorar:', err);
    return error('No se pudo guardar la valoración.', 500);
  }
};
