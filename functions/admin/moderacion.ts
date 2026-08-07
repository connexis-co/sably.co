/** GET/POST /admin/moderacion — cola y decisiones. */
import { type Env, e, fecha, irA, moderadorDe, noAutorizado, pagina } from './_ui';

/**
 * Cambia el estado y escribe la auditoría en el mismo batch.
 *
 * Van juntos a propósito: si el registro fuera una segunda llamada, un fallo
 * entre ambas dejaría un comentario aprobado sin constancia de quién lo hizo,
 * que es justo lo que habría que enseñar si alguien lo pregunta.
 */
async function moderar(
  db: D1Database, entidad: 'comment' | 'course_review', id: string,
  estado: string, moderador: string,
) {
  const previo = await db.prepare(`SELECT status FROM ${entidad} WHERE id=?`).bind(id)
    .first<{ status: string }>();
  await db.batch([
    db.prepare(`UPDATE ${entidad} SET status=?, moderated_at=unixepoch() WHERE id=?`).bind(estado, id),
    db.prepare(
      `INSERT INTO moderation_log (id,entity,entity_id,from_status,to_status,moderator)
       VALUES (?,?,?,?,?,?)`,
    ).bind(crypto.randomUUID(), entidad, id, previo?.status ?? null, estado, moderador),
  ]);
}

/**
 * Se modera con POST y nunca con GET: los clientes de correo hacen prefetch de
 * los enlaces, así que un GET que cambiara el estado aprobaría comentarios solo
 * con que Gmail precargara el aviso.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const mod = await moderadorDe(request, env);
  if (!mod) return noAutorizado();
  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const entidad = String(f.get('entidad') ?? '');
  const accion = String(f.get('accion') ?? '');
  if (id && (entidad === 'comment' || entidad === 'course_review') &&
      ['approved', 'rejected', 'spam'].includes(accion)) {
    await moderar(env.DB, entidad, id, accion, mod);
  }
  return irA('/admin/moderacion');
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const mod = await moderadorDe(request, env);
  if (!mod) return noAutorizado();

  const { results } = await env.DB.prepare(
    `SELECT entity,id,subject_id,author_name,body,spam_score,created_at
       FROM v_moderacion ORDER BY created_at DESC LIMIT 100`,
  ).all<{
    entity: string; id: string; subject_id: string; author_name: string;
    body: string; spam_score: number; created_at: number;
  }>();
  const cola = results ?? [];

  const boton = (id: string, ent: string, val: string, cls: string, txt: string) =>
    `<form method="POST" class="fila"><input type="hidden" name="id" value="${e(id)}">
     <input type="hidden" name="entidad" value="${e(ent)}">
     <button class="${cls}" name="accion" value="${val}">${txt}</button></form>`;

  const cuerpo = cola.length === 0
    ? '<div class="caja"><div class="vacio">No hay nada pendiente.</div></div>'
    : `<div class="caja"><table><thead><tr>
<th>Tipo</th><th>Autor</th><th>Contenido</th><th>Dónde</th><th>Spam</th><th>Fecha</th><th>Acción</th>
</tr></thead><tbody>${cola.map((c) => `<tr>
<td>${c.entity === 'comment' ? 'Comentario' : 'Reseña'}</td>
<td>${e(c.author_name)}</td>
<td style="max-width:34ch">${e(c.body)}</td>
<td><code>${e(c.subject_id)}</code></td>
<td${c.spam_score > 0.5 ? ' style="color:#d93025;font-weight:700"' : ''}>${(c.spam_score * 100).toFixed(0)}%</td>
<td>${fecha(c.created_at)}</td>
<td style="white-space:nowrap">
${boton(c.id, c.entity, 'approved', 'ok', 'Aprobar')}
${boton(c.id, c.entity, 'rejected', 'no', 'Rechazar')}
${boton(c.id, c.entity, 'spam', '', 'Spam')}
</td></tr>`).join('')}</tbody></table></div>`;

  return pagina('Cola de moderación', mod, 'moderacion', cuerpo + `
<p class="nota">Cada decisión queda en <code>moderation_log</code> con tu correo y la hora.
Aprobar no publica al instante: el contenido entra en el sitio en el siguiente despliegue.</p>`);
};
