/**
 * GET /api/v1/abandonos-notify?key=<SNAPSHOT_TOKEN> — recuperación de carritos.
 *
 * Toma los abandonos de las últimas 48 h sin notificar (los guarda el webhook de
 * Hotmart en `hotmart_eventos`) y envía:
 *  1. Un correo de recuperación al prospecto (vía Resend) recordándole su 50%.
 *  2. Copia de aviso a NOTIFY_EMAIL para seguimiento manual (WhatsApp, etc.).
 *
 * Sin RESEND_API_KEY responde cuántos hay pendientes y no envía nada.
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
    <a href="https://academiadebelleza.edu.co/?utm_source=email&utm_medium=crm&utm_campaign=carrito-abandonado"
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
  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM) {
    return json({ ok: true, pendientes: pendientes.length, enviados: 0, motivo: 'falta RESEND_API_KEY/NOTIFY_FROM' });
  }

  let enviados = 0;
  const fallos: string[] = [];
  for (const p of pendientes) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.NOTIFY_FROM,
        to: [p.buyer_email],
        bcc: env.NOTIFY_EMAIL ? [env.NOTIFY_EMAIL] : undefined,
        reply_to: env.NOTIFY_EMAIL || undefined,
        subject: 'Tu cupo con 50% sigue guardado 🎓',
        html: plantilla(p.buyer_name, p.product_name),
      }),
    });
    if (r.ok) {
      enviados += 1;
      await env.DB.prepare('UPDATE hotmart_eventos SET notified_at = datetime(\'now\') WHERE id = ?')
        .bind(p.id).run();
    } else {
      fallos.push(`${p.buyer_email}:${r.status}`);
    }
  }
  return json({ ok: true, pendientes: pendientes.length, enviados, fallos: fallos.length ? fallos : undefined });
};
