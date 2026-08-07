/** GET /admin — resumen. */
import { type Env, moderadorDe, noAutorizado, pagina } from './_ui';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const mod = await moderadorDe(request, env);
  if (!mod) return noAutorizado();

  const semana = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const lote = await env.DB.batch<{ n: number }>([
    env.DB.prepare("SELECT COUNT(*) AS n FROM comment WHERE status='pending'"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM course_review WHERE status='pending'"),
    env.DB.prepare('SELECT COUNT(*) AS n FROM lead WHERE created_at > ?').bind(semana),
    env.DB.prepare('SELECT COUNT(*) AS n FROM vote'),
    env.DB.prepare('SELECT COUNT(*) AS n FROM v_article_pulse WHERE votes > 0'),
  ]);
  // Si una sentencia fallara, un cero es mejor panel que una excepción que
  // deja al moderador sin nada que ver.
  const n = (i: number) => lote[i]?.results?.[0]?.n ?? 0;
  const pend = n(0) + n(1);

  const tarjeta = (v: number, t: string, avisa = false) =>
    `<div class="tarjeta${avisa && v > 0 ? ' avisa' : ''}"><div class="n">${v}</div><div class="t">${t}</div></div>`;

  return pagina('Resumen', mod, 'resumen', `
${pend > 0 ? `<div class="aviso">Hay <b>${pend}</b> ${pend === 1 ? 'elemento pendiente' : 'elementos pendientes'} de moderar. Nada de eso se ve en el sitio hasta que lo apruebes. <a class="boton" href="/admin/moderacion" style="margin-left:.6rem">Ir a la cola</a></div>` : ''}
<div class="tarjetas">
  ${tarjeta(n(0), 'Comentarios por moderar', true)}
  ${tarjeta(n(1), 'Reseñas por moderar', true)}
  ${tarjeta(n(2), 'Leads (7 días)')}
  ${tarjeta(n(3), 'Votos recibidos')}
  ${tarjeta(n(4), 'Artículos con votos')}
</div>
<p class="nota">Los promedios que ve el público no salen de aquí en caliente: se hornean en el
build desde un snapshot, así que un número aparece en el sitio tras un despliegue. Es a propósito,
porque lo que lee Google tiene que ser auditable en el HTML servido.</p>`);
};
