/**
 * GET /api/v1/snapshot — lo que el build baja para hornear en el HTML.
 *
 * Protegido con SNAPSHOT_TOKEN porque incluye la cola de moderación. Devuelve
 * las vistas ya calculadas: el build no ejecuta lógica de negocio, solo pinta.
 */
import { type Env, error, json } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.SNAPSHOT_TOKEN || auth !== `Bearer ${env.SNAPSHOT_TOKEN}`) {
    return error('no autorizado', 401);
  }

  const [articulos, cursos, comentarios] = await Promise.all([
    env.DB.prepare('SELECT slug, votes, avg_rating, distinct_ips FROM v_article_pulse').all(),
    env.DB.prepare('SELECT slug, reviews, avg_rating FROM v_course_rating').all(),
    env.DB.prepare(
      'SELECT slug, author_name, body, country, created_at FROM v_comment_publico LIMIT 5000',
    ).all(),
  ]);

  return json({
    generado_en: Math.floor(Date.now() / 1000),
    articulos: articulos.results ?? [],
    cursos: cursos.results ?? [],
    comentarios: comentarios.results ?? [],
  });
};
