/**
 * POST /api/v1/subjects — siembra el catálogo antes del build.
 *
 * Sin esto la clave foránea de vote y comment rechaza todo, que es
 * precisamente lo que se busca: no se puede votar algo que no existe.
 */
import { type Env, error, json } from './_shared';

interface Cuerpo {
  subjects?: { kind: 'blog' | 'course'; slug: string }[];
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.SNAPSHOT_TOKEN || auth !== `Bearer ${env.SNAPSHOT_TOKEN}`) {
    return error('no autorizado', 401);
  }

  let b: Cuerpo;
  try {
    b = await request.json();
  } catch {
    return error('cuerpo JSON inválido');
  }
  if (!Array.isArray(b.subjects) || !b.subjects.length) return error('falta subjects');

  // Todo lo que no venga en esta siembra se desactiva en vez de borrarse: si
  // un curso se retira, sus votos siguen ahí por si vuelve.
  const sentencias = [
    env.DB.prepare('UPDATE subject SET is_active = 0'),
    ...b.subjects.map((s) =>
      env.DB.prepare(
        `INSERT INTO subject (id, kind, slug, is_active) VALUES (?, ?, ?, 1)
         ON CONFLICT (id) DO UPDATE SET is_active = 1, seeded_at = unixepoch()`,
      ).bind(`${s.kind}:${s.slug}`, s.kind, s.slug),
    ),
  ];
  await env.DB.batch(sentencias);

  const { count } = (await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM subject WHERE is_active = 1',
  ).first<{ count: number }>()) ?? { count: 0 };

  return json({ ok: true, activos: count });
};
