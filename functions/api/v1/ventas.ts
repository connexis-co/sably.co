/**
 * GET /api/v1/ventas?key=<SNAPSHOT_TOKEN> — la base de compradores/eventos de Hotmart
 * que alimenta el webhook (functions/api/hotmart-webhook.js) en JSON.
 *
 * Parámetros: limit (≤500, def. 100), offset, event (PURCHASE_APPROVED…),
 * q (busca en email/nombre/producto).
 */
import { type Env, error, json } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.SNAPSHOT_TOKEN || url.searchParams.get('key') !== env.SNAPSHOT_TOKEN) {
    return error('no autorizado', 401);
  }

  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100) || 100, 500);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
  const event = (url.searchParams.get('event') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();

  const where: string[] = [];
  const args: unknown[] = [];
  if (event) {
    where.push('event = ?');
    args.push(event);
  }
  if (q) {
    where.push('(buyer_email LIKE ? OR buyer_name LIKE ? OR product_name LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  const filtro = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const filas = await env.DB.prepare(
    `SELECT transaction_code, event, status, product_id, product_name, buyer_name, buyer_email,
            buyer_phone, country_iso, country_name, value, currency, sck_fbp, sck_fbc, sck_cid,
            sck_gclid, created_at
     FROM hotmart_eventos ${filtro}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(...args, limit, offset).all();

  const resumen = await env.DB.prepare(
    `SELECT event, COUNT(*) AS n, currency, ROUND(SUM(COALESCE(value, 0)), 2) AS total
     FROM hotmart_eventos GROUP BY event, currency ORDER BY n DESC`,
  ).all();

  return json({ resumen: resumen.results, ventas: filas.results, limit, offset });
};
