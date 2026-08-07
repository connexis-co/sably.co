/**
 * GET /api/v1/pulso?subject=… — el único endpoint de lectura en caliente.
 *
 * Sirve para que quien acaba de votar vea su voto reflejado sin recargar. NO
 * alimenta el marcado de Schema.org: eso se hornea en el build desde el
 * snapshot, para que lo que lee Google sea auditable en dist/ y no dependa de
 * que un fetch responda a tiempo.
 */
import { type Env, error, json } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const subject = new URL(request.url).searchParams.get('subject');
  if (!subject) return error('falta el parámetro subject');

  const fila = await env.DB.prepare(
    'SELECT votes, avg_rating, distinct_ips FROM v_article_pulse WHERE subject_id = ?',
  )
    .bind(subject)
    .first<{ votes: number; avg_rating: number | null; distinct_ips: number }>();

  return json({
    votes: fila?.votes ?? 0,
    avg: fila?.avg_rating ?? null,
    // El umbral vive en el build, no aquí, pero se expone para que el widget
    // sepa si tiene sentido enseñar un promedio.
    publicable: (fila?.votes ?? 0) >= 5 && (fila?.distinct_ips ?? 0) >= 5,
  });
};
