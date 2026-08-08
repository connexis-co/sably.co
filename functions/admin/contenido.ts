/**
 * GET /admin/contenido — salud del catálogo.
 *
 * Los datos salen de la tabla subject (que siembra el prebuild) y de las
 * propias vistas, no de las content collections: una Pages Function no tiene
 * acceso al repositorio.
 */
import { type Env, e, noAutorizado, sesion, pagina } from './_ui';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const lote = await env.DB.batch<{ n: number }>([
    env.DB.prepare("SELECT COUNT(*) AS n FROM subject WHERE kind='course' AND is_active=1"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM subject WHERE kind='blog' AND is_active=1"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM course_review WHERE status='approved'"),
    env.DB.prepare('SELECT COUNT(*) AS n FROM purchase'),
  ]);
  const n = (i: number) => lote[i]?.results?.[0]?.n ?? 0;

  // Cursos que ya podrían mostrar estrellas: hacen falta 5 reseñas aprobadas,
  // cada una atada por clave foránea a una compra real.
  const { results: conEstrellas } = await env.DB.prepare(
    'SELECT slug, reviews, avg_rating FROM v_course_rating WHERE reviews >= 5 ORDER BY reviews DESC LIMIT 50',
  ).all<{ slug: string; reviews: number; avg_rating: number }>();

  const { results: masVotados } = await env.DB.prepare(
    'SELECT slug, votes, avg_rating FROM v_article_pulse WHERE votes > 0 ORDER BY votes DESC LIMIT 20',
  ).all<{ slug: string; votes: number; avg_rating: number }>();

  const tarjeta = (v: number, t: string) =>
    `<div class="tarjeta"><div class="n">${v}</div><div class="t">${t}</div></div>`;

  const tabla = (
    filas: { slug: string; a: number; b: number }[],
    cabA: string, cabB: string, vacio: string,
  ) => filas.length === 0
    ? `<div class="caja"><div class="vacio">${vacio}</div></div>`
    : `<div class="caja"><table><thead><tr><th>Slug</th><th>${cabA}</th><th>${cabB}</th></tr></thead>
<tbody>${filas.map((f) => `<tr><td><code>${e(f.slug)}</code></td><td>${f.a}</td><td>${f.b ?? '—'}</td></tr>`).join('')}
</tbody></table></div>`;

  return pagina('Estado del contenido', mod, 'contenido', `
<div class="tarjetas">
  ${tarjeta(n(0), 'Cursos en el catálogo')}
  ${tarjeta(n(1), 'Artículos del blog')}
  ${tarjeta(n(3), 'Compras verificadas')}
  ${tarjeta(n(2), 'Reseñas aprobadas')}
  ${tarjeta((conEstrellas ?? []).length, 'Cursos que ya pueden mostrar estrellas')}
</div>

<h2>Cursos con suficientes reseñas para publicar valoración</h2>
<p class="nota" style="margin-top:0">Hacen falta 5 reseñas aprobadas, y cada una tiene que venir de
una compra verificada de Hotmart. La base lo impide de otro modo: <code>purchase_id</code> es único
y con clave foránea a <code>purchase</code>.</p>
${tabla((conEstrellas ?? []).map((c) => ({ slug: c.slug, a: c.reviews, b: c.avg_rating })),
        'Reseñas', 'Promedio', 'Ningún curso llega todavía al mínimo de 5 reseñas verificadas.')}

<h2>Artículos más votados</h2>
${tabla((masVotados ?? []).map((a) => ({ slug: a.slug, a: a.votes, b: a.avg_rating })),
        'Votos', 'Promedio', 'Todavía no hay votos.')}

<p class="nota">Si el catálogo aparece vacío es que falta sembrarlo: el prebuild sube los slugs a
<code>subject</code> con <code>POST /api/v1/subjects</code>. Sin esa siembra, la clave foránea
rechaza cualquier voto o comentario, que es justo lo que se busca.</p>`);
};
