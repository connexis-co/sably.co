/** GET /admin/leads — listado, filtro por país y exportación CSV. */
import { type Env, e, fecha, noAutorizado, sesion, pagina } from './_ui';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email: mod, motivo } = await sesion(request, env);
  if (!mod) return noAutorizado(motivo);

  const url = new URL(request.url);
  const pais = url.searchParams.get('pais') ?? '';
  const filtro = pais ? 'WHERE country = ?' : '';
  const args = pais ? [pais] : [];

  // El CSV se arma en el servidor y solo cuando se pide: así los correos no
  // viajan al navegador en cada visita al listado.
  if (url.searchParams.get('csv') === '1') {
    const { results } = await env.DB.prepare(
      `SELECT name,email,phone,course_interest,country,source,created_at
         FROM lead ${filtro} ORDER BY created_at DESC LIMIT 5000`,
    ).bind(...args).all<Record<string, unknown>>();
    const q = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = ['nombre,correo,telefono,curso,pais,origen,fecha',
      ...(results ?? []).map((r) => [r.name, r.email, r.phone, r.course_interest,
        r.country, r.source, new Date(Number(r.created_at) * 1000).toISOString()]
        .map(q).join(','))].join('\n');
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="leads-sably-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const { results } = await env.DB.prepare(
    `SELECT name,email,phone,course_interest,country,source,created_at
       FROM lead ${filtro} ORDER BY created_at DESC LIMIT 200`,
  ).bind(...args).all<{
    name: string; email: string; phone: string | null; course_interest: string | null;
    country: string | null; source: string | null; created_at: number;
  }>();
  const leads = results ?? [];

  const { results: porPais } = await env.DB.prepare(
    'SELECT country, COUNT(*) AS n FROM lead GROUP BY country ORDER BY n DESC',
  ).all<{ country: string | null; n: number }>();

  const filtros = [
    `<a class="boton" href="/admin/leads"${!pais ? ' style="font-weight:700"' : ''}>Todos</a>`,
    ...(porPais ?? []).map((p) =>
      `<a class="boton" href="/admin/leads?pais=${e(p.country ?? '')}"${pais === p.country ? ' style="font-weight:700"' : ''}>${e(p.country ?? '—')} (${p.n})</a>`),
    `<a class="boton" style="margin-left:auto" href="/admin/leads?csv=1${pais ? `&pais=${e(pais)}` : ''}">Exportar CSV</a>`,
  ].join('');

  const tabla = leads.length === 0
    ? '<div class="caja"><div class="vacio">Todavía no hay leads.</div></div>'
    : `<div class="caja"><table><thead><tr>
<th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Curso</th><th>País</th><th>Origen</th><th>Fecha</th>
</tr></thead><tbody>${leads.map((l) => `<tr>
<td>${e(l.name)}</td><td><a href="mailto:${e(l.email)}">${e(l.email)}</a></td>
<td>${e(l.phone ?? '—')}</td><td>${e(l.course_interest ?? '—')}</td>
<td>${e(l.country ?? '—')}</td><td>${e(l.source ?? '—')}</td><td>${fecha(l.created_at)}</td>
</tr>`).join('')}</tbody></table></div>`;

  return pagina('Leads', mod, 'leads', `
<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">${filtros}</div>
${tabla}
<p class="nota">Cada lead lleva su registro de autorización en <code>consent</code>, con el texto
que se le mostró. Se purgan solos a los dos años mediante <code>purge_after</code>.</p>`);
};
