/** GET/POST /admin/despliegue — reconstruye el sitio bajo demanda. */
import { type Env, fecha, irA, moderadorDe, noAutorizado, pagina, e } from './_ui';

/**
 * Dispara el workflow de GitHub Actions, no un deploy hook de Pages.
 *
 * El proyecto de Pages no tiene integración con Git —despliega con wrangler
 * desde Actions—, así que un deploy hook no tiene nada que construir y
 * responde 500. Además el build necesita los secretos y los scripts que viven
 * en el repositorio, o sea que Actions es donde tiene que ocurrir.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const mod = await moderadorDe(request, env);
  if (!mod) return noAutorizado();
  if (!env.GITHUB_TOKEN) return irA('/admin/despliegue?r=sin-hook');

  const r = await fetch(
    'https://api.github.com/repos/connexis-co/sably.co/actions/workflows/deploy-production.yml/dispatches',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'sably-admin',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  );
  if (r.ok) {
    await env.DB.prepare(
      `INSERT INTO moderation_log (id,entity,entity_id,to_status,moderator,reason)
       VALUES (?,'comment','deploy','triggered',?,'despliegue manual desde el panel')`,
    ).bind(crypto.randomUUID(), mod).run();
  }
  return irA(`/admin/despliegue?r=${r.ok ? 'ok' : 'fallo'}`);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const mod = await moderadorDe(request, env);
  if (!mod) return noAutorizado();

  const r = new URL(request.url).searchParams.get('r');
  const avisos: Record<string, string> = {
    ok: 'Despliegue lanzado en GitHub Actions. Reconstruir las 5.918 páginas tarda unos minutos.',
    fallo: 'GitHub rechazó la petición. Comprueba que el token siga vigente y con permiso sobre Actions.',
    'sin-hook': 'No hay GITHUB_TOKEN configurado, así que no se lanzó nada.',
  };

  const { results } = await env.DB.prepare(
    `SELECT moderator, created_at FROM moderation_log
      WHERE entity_id='deploy' ORDER BY created_at DESC LIMIT 10`,
  ).all<{ moderator: string; created_at: number }>();

  // Lo aprobado después del último despliegue es lo que aún no se ve.
  const ultimo = results?.[0]?.created_at ?? 0;
  const fila = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comment WHERE status='approved' AND moderated_at > ?",
  ).bind(ultimo).first<{ n: number }>();
  const sinPublicar = fila?.n ?? 0;

  const historial = (results ?? []).length === 0
    ? '<div class="caja"><div class="vacio">Ninguno todavía.</div></div>'
    : `<div class="caja"><table><thead><tr><th>Quién</th><th>Cuándo</th></tr></thead><tbody>
${(results ?? []).map((d) => `<tr><td>${e(d.moderator)}</td><td>${fecha(d.created_at)}</td></tr>`).join('')}
</tbody></table></div>`;

  return pagina('Despliegue', mod, 'despliegue', `
${r && avisos[r] ? `<div class="aviso">${avisos[r]}</div>` : ''}
<p class="nota" style="margin-top:0">El sitio es estático: lo que se aprueba aquí no aparece en las
páginas hasta reconstruirlas. Se hace así para que lo que lee Google viaje en el HTML servido y sea
auditable, en vez de inyectarse por JavaScript.</p>
${sinPublicar > 0 ? `<div class="aviso">Hay <b>${sinPublicar}</b> ${sinPublicar === 1 ? 'comentario aprobado' : 'comentarios aprobados'} desde el último despliegue. Todavía no se ven en el sitio.</div>` : ''}
<form method="POST" style="margin:1.5rem 0">
  <button class="pri" type="submit">Reconstruir y desplegar el sitio</button>
</form>
<h2>Despliegues lanzados desde el panel</h2>
${historial}
<p class="nota">Se dispara el workflow <code>deploy-production.yml</code> de GitHub Actions: el
proyecto de Pages no tiene integración con Git y el build necesita los scripts y secretos del
repositorio. Los despliegues por <code>git push</code> no aparecen en esta lista, solo los
lanzados desde aquí.</p>`);
};
