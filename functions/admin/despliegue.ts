/** GET/POST /admin/despliegue — reconstruye el sitio bajo demanda. */
import { type Env, fecha, irA, moderadorDe, noAutorizado, pagina, e } from './_ui';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const mod = await moderadorDe(request, env);
  if (!mod) return noAutorizado();
  if (!env.DEPLOY_HOOK_URL) return irA('/admin/despliegue?r=sin-hook');

  const r = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
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
    ok: 'Despliegue lanzado. Reconstruir las 5.918 páginas tarda unos minutos.',
    fallo: 'El hook respondió con error. Revisa la URL en las variables del proyecto.',
    'sin-hook': 'No hay DEPLOY_HOOK_URL configurado, así que no se lanzó nada.',
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
<p class="nota">Los despliegues automáticos por <code>git push</code> a <code>main</code> no
aparecen aquí: solo se registran los que se lanzan desde este botón.</p>`);
};
