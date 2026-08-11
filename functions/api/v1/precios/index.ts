/**
 * /api/v1/precios — precios y valoraciones reales de Hotmart.
 *
 * GET  → volcado completo {precios, valoraciones}, cacheado 5 min en el borde.
 *        Lo consumen el job nocturno (para fundirlo en el JSON horneado) y el
 *        cliente cuando quiere un dato más fresco que el del build.
 * POST → alta/actualización en lote, autenticada con SNAPSHOT_TOKEN. La usa la
 *        captura inicial y cualquier re-siembra manual.
 */
import type { Env } from '../_shared';
import { error, json } from '../_shared';

const cacheado = (data: unknown, segundos: number): Response =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${segundos}, s-maxage=${segundos}`,
      'access-control-allow-origin': '*',
    },
  });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const lote = await env.DB.batch([
      env.DB.prepare('SELECT slug, moneda, monto, capturado FROM hotmart_precio'),
      env.DB.prepare('SELECT slug, rating, total, capturado FROM hotmart_valoracion'),
    ]);
    const precios: Record<string, Record<string, number>> = {};
    for (const r of (lote[0]?.results ?? []) as { slug: string; moneda: string; monto: number }[]) {
      (precios[r.slug] ??= {})[r.moneda] = r.monto;
    }
    const valoraciones: Record<string, { rating: number; total: number }> = {};
    for (const r of (lote[1]?.results ?? []) as { slug: string; rating: number; total: number }[]) {
      valoraciones[r.slug] = { rating: r.rating, total: r.total };
    }
    return cacheado({ precios, valoraciones }, 300);
  } catch {
    // Migración sin aplicar: el sitio vive del JSON horneado, aquí vacío honesto.
    return cacheado({ precios: {}, valoraciones: {} }, 300);
  }
};

interface Lote {
  productos?: { slug: string; payUrl: string; hotlink?: string }[];
  precios?: { slug: string; moneda: string; monto: number }[];
  valoraciones?: { slug: string; rating: number; total: number }[];
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.SNAPSHOT_TOKEN || auth !== `Bearer ${env.SNAPSHOT_TOKEN}`) {
    return error('No autorizado.', 401);
  }

  let lote: Lote;
  try {
    lote = (await request.json()) as Lote;
  } catch {
    return error('Cuerpo JSON inválido.');
  }

  const sentencias = [];
  for (const p of lote.productos ?? []) {
    if (!p.slug || !/^https:\/\/pay\.hotmart\.com\//.test(p.payUrl)) continue;
    sentencias.push(
      env.DB.prepare(
        `INSERT INTO hotmart_producto (slug, pay_url, hotlink, actualizado)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET pay_url = excluded.pay_url,
           hotlink = excluded.hotlink, actualizado = unixepoch()`,
      ).bind(p.slug, p.payUrl, p.hotlink ?? ''),
    );
  }
  for (const p of lote.precios ?? []) {
    if (!p.slug || !/^[A-Z]{3}$/.test(p.moneda) || !(p.monto > 0)) continue;
    sentencias.push(
      env.DB.prepare(
        `INSERT INTO hotmart_precio (slug, moneda, monto, capturado)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT(slug, moneda) DO UPDATE SET monto = excluded.monto, capturado = unixepoch()`,
      ).bind(p.slug, p.moneda, p.monto),
    );
  }
  for (const v of lote.valoraciones ?? []) {
    if (!v.slug || !(v.rating >= 1 && v.rating <= 5) || !(v.total >= 0)) continue;
    sentencias.push(
      env.DB.prepare(
        `INSERT INTO hotmart_valoracion (slug, rating, total, capturado)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET rating = excluded.rating,
           total = excluded.total, capturado = unixepoch()`,
      ).bind(v.slug, v.rating, v.total),
    );
  }

  if (!sentencias.length) return error('Nada que guardar.');
  await env.DB.batch(sentencias);
  return json({ guardados: sentencias.length });
};
