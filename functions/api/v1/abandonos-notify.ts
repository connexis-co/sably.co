/**
 * GET /api/v1/abandonos-notify?key=<SNAPSHOT_TOKEN> — recuperación de carritos.
 *
 * Toma los abandonos de las últimas 48 h sin notificar (los guarda el webhook de
 * Hotmart en `hotmart_eventos`) y envía:
 *  1. Un correo de recuperación al prospecto (mediante el proveedor seleccionado en EmDash) recordándole su 50%.
 * El destinatario del equipo se utiliza para Reply-To; no se expone en CC.
 *
 * Sin proveedor EmDash y destinatario del equipo, informa pendientes sin enviar.
 * Lo invoca el cron de GitHub Actions (.github/workflows/abandonos-cron.yml).
 */
import { type Env, error, json } from './_shared';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
));

const plantilla = (nombre: string, producto: string) => `<!doctype html>
<div style="font:15px/1.6 -apple-system,system-ui,sans-serif;color:#1f2937;max-width:520px;margin:0 auto;padding:24px">
  <p>Hola${nombre ? ` ${esc(nombre.split(' ')[0])}` : ''} 👋</p>
  <p>Vimos que empezaste tu inscripción a <b>${esc(producto || 'tu curso')}</b> y quedó a medias.</p>
  <p><b>Tu cupo con el 50% de descuento sigue guardado</b> — con certificado incluido,
  acceso de por vida y garantía de 7 días de Hotmart.</p>
  <p style="margin:28px 0">
    <a href="https://sably.co/?utm_source=email&utm_medium=crm&utm_campaign=carrito-abandonado"
       style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">
       Terminar mi inscripción con 50%</a>
  </p>
  <p>Si tuviste algún problema con el pago o tienes dudas, <b>responde este correo</b>
  y te ayudamos personalmente (también podemos enviarte el enlace directo de tu curso).</p>
  <p style="color:#6b7280;font-size:12px;margin-top:32px">Recibes este único recordatorio porque
  iniciaste una compra en nuestro sitio. Si no quieres recibir más mensajes, responde con la
  palabra BAJA y te eliminamos de inmediato.</p>
</div>`;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.SNAPSHOT_TOKEN || url.searchParams.get('key') !== env.SNAPSHOT_TOKEN) {
    return error('no autorizado', 401);
  }

  const pendientes = (await env.DB.prepare(
    `SELECT id, buyer_name, buyer_email, product_name FROM hotmart_eventos
     WHERE (event LIKE '%ABANDONMENT%' OR event = 'PURCHASE_OUT_OF_SHOPPING_CART')
       AND notified_at IS NULL
       AND buyer_email IS NOT NULL
       AND created_at > datetime('now', '-48 hours')
     ORDER BY created_at ASC LIMIT 20`,
  ).all()).results as Array<{ id: string; buyer_name: string; buyer_email: string; product_name: string }>;

  if (!pendientes.length) return json({ ok: true, pendientes: 0, enviados: 0 });

  if (!env.MAIL) {
    return json({ ok: true, pendientes: pendientes.length, enviados: 0, motivo: 'Configura el proveedor de correo de EmDash y el destinatario del equipo.' });
  }

  let enviados = 0;
  const fallos: string[] = [];
  for (const p of pendientes) {
    const ok = await enviarCorreo(env, {
      to: p.buyer_email,
      subject: 'Tu cupo con 50% sigue guardado 🎓',
      html: plantilla(p.buyer_name, p.product_name),
    });
    if (ok === true) {
      enviados += 1;
      await env.DB.prepare('UPDATE hotmart_eventos SET notified_at = datetime(\'now\') WHERE id = ?')
        .bind(p.id).run();
    } else {
      fallos.push(p.id);
    }
  }
  return json({ ok: true, proveedor: 'emdash', pendientes: pendientes.length, enviados, fallos: fallos.length ? fallos : undefined });
};

/** The selected EmDash provider owns sender identity and encrypted credentials. */
async function enviarCorreo(env: Env, msg: {to:string;subject:string;html:string}): Promise<true|string> {
  if (!env.MAIL) return 'unconfigured';
  try {
    await env.MAIL.send({to:msg.to,replyTo:env.MAIL.notificationEmail,subject:msg.subject,
      text:'Tu inscripción quedó pendiente. Puedes continuar en https://sably.co/ o responder este correo para recibir ayuda.',html:msg.html});
    return true;
  } catch { return 'delivery_failed'; }
}
