/**
 * Webhook de Hotmart → D1 (base de compradores) + Meta CAPI + GA4 (macro conversión).
 *
 * v3 — persistencia: cada evento con datos de compra (aprobada, completa, reembolso,
 * chargeback, cancelada, abandono de carrito…) se guarda en D1 ANTES de reenviar,
 * con el nombre, correo, teléfono, país, producto, valor y la atribución sck
 * (fbp/fbc/cid/gclid) que adjunta el decorador de GTM. Los reintentos de Hotmart
 * no duplican (UNIQUE transaction+event). Los tests del panel no se guardan.
 *
 * Panel: /admin/ventas?key=<SNAPSHOT_TOKEN> · API: /api/v1/ventas?key=…
 * Vars en Pages: META_CAPI_TOKEN, GA4_API_SECRET (+ META_CAPI_PIXEL_ID,
 * GA4_MEASUREMENT_ID y HOTMART_HOTTOK; META_TEST_EVENT_CODE opcional).
 */

const sha256 = async (text) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const ulid = () => {
  const t = Date.now().toString(36).padStart(9, '0');
  const r = crypto.getRandomValues(new Uint8Array(10));
  return (t + [...r].map((b) => b.toString(36).padStart(2, '0')).join('')).toUpperCase();
};

/** El decorador de GTM arma: "fbp~..." | "fbc~..." | "cid~123.456" | "gcl~..." */
const parseSck = (raw) => {
  const out = {};
  for (const part of String(raw ?? '').split('|')) {
    const i = part.indexOf('~');
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
};

export async function onRequestPost({ request, env }) {
  if (env.HOTMART_HOTTOK) {
    const hottok = request.headers.get('x-hotmart-hottok');
    if (hottok !== env.HOTMART_HOTTOK) return new Response('forbidden', { status: 403 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const event = payload?.event ?? '';
  const data = payload?.data ?? {};
  const purchase = data.purchase ?? {};
  const status = purchase.status ?? '';
  const transaction = purchase.transaction ?? `hm-${Date.now()}`;
  const sck = parseSck(purchase?.origin?.sck ?? purchase?.sck);
  const clientId = /^\d+\.\d+$/.test(sck.cid ?? '') ? sck.cid : `hotmart.${transaction}`;
  const mid = env.GA4_MEASUREMENT_ID;

  const buyerEmail = String(data?.buyer?.email ?? '').trim().toLowerCase();
  const buyerName = String(data?.buyer?.name ?? '').trim();
  const buyerPhone = String(data?.buyer?.checkout_phone ?? data?.buyer?.phone ?? '').replace(/\D/g, '');
  const value = Number(purchase?.price?.value ?? purchase?.full_price?.value ?? 0);
  const currency = purchase?.price?.currency_value ?? purchase?.price?.currency_code ?? '';
  const productName = data?.product?.name ?? '';
  const productId = String(data?.product?.id ?? '');
  const countryIso = String(purchase?.checkout_country?.iso ?? '').toUpperCase();
  const countryName = String(purchase?.checkout_country?.name ?? '');

  // Tests del panel de Hotmart: ni base de datos ni reenvío.
  if (buyerEmail.endsWith('@example.com') || /^testeComprador/i.test(buyerName)) {
    return Response.json({ ok: true, skipped: 'hotmart-test-payload' });
  }

  const results = { db: null, capi: null, ga4: null, attribution: Object.keys(sck).join(',') || 'none' };

  // ── D1: base de compradores/eventos (todo evento con datos útiles) ──
  if (env.DB && (buyerEmail || transaction.startsWith('hm-') === false)) {
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO hotmart_eventos
         (id, transaction_code, event, status, product_id, product_name, buyer_name, buyer_email,
          buyer_phone, country_iso, country_name, value, currency, sck_fbp, sck_fbc, sck_cid,
          sck_gclid, approved_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        ulid(), transaction, event || status || 'UNKNOWN', status || null,
        productId || null, productName || null, buyerName || null, buyerEmail || null,
        buyerPhone || null, countryIso || null, countryName || null,
        Number.isFinite(value) && value > 0 ? value : null, currency || null,
        sck.fbp ?? null, sck.fbc ?? null, sck.cid ?? null, sck.gcl ?? null,
        Number(purchase?.approved_date) || null,
      ).run();
      results.db = 'ok';
    } catch (e) {
      results.db = `error:${String(e.message).slice(0, 120)}`;
    }
  } else {
    results.db = 'skipped';
  }

  // ── Reembolsos y contracargos → refund en GA4 y fin ────────
  if (['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'].includes(event) || ['REFUNDED', 'CHARGEBACK'].includes(status)) {
    if (env.GA4_API_SECRET && mid) {
      const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${mid}&api_secret=${env.GA4_API_SECRET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, events: [{ name: 'refund', params: { transaction_id: transaction } }] }),
      });
      results.ga4 = r.status < 300 ? 'ok:refund' : `error:${r.status}`;
    }
    return Response.json({ ok: true, refund: transaction, results });
  }

  // Solo las compras aprobadas/completas se reenvían como conversión.
  if (event !== 'PURCHASE_APPROVED' && status !== 'APPROVED' && status !== 'COMPLETE') {
    return Response.json({ ok: true, stored: results.db, skipped: `${event}/${status}` });
  }

  // ── Meta CAPI ──────────────────────────────────────────────
  if (env.META_CAPI_TOKEN && env.META_CAPI_PIXEL_ID) {
    const pixel = env.META_CAPI_PIXEL_ID;
    const userData = {};
    if (buyerEmail) userData.em = [await sha256(buyerEmail)];
    if (buyerPhone) userData.ph = [await sha256(buyerPhone)];
    if (countryIso) userData.country = [await sha256(countryIso.toLowerCase())];
    if (sck.fbp) userData.fbp = sck.fbp;
    if (sck.fbc) userData.fbc = sck.fbc;
    const body = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `hotmart.${transaction}`,
        action_source: 'website',
        event_source_url: 'https://sably.co/',
        user_data: userData,
        custom_data: {
          value,
          currency: currency || 'COP',
          content_name: productName || 'curso',
          content_ids: productId ? [productId] : undefined,
          content_type: 'product',
          order_id: transaction,
        },
      }],
    };
    if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;
    try {
      const r = await fetch(`https://graph.facebook.com/v23.0/${pixel}/events?access_token=${env.META_CAPI_TOKEN}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = await r.json();
      results.capi = r.ok ? `ok:${out.events_received ?? 1}` : `error:${JSON.stringify(out.error ?? out).slice(0, 180)}`;
    } catch (e) {
      results.capi = `error:${e.message}`;
    }
  } else {
    results.capi = 'skipped:missing-token-or-pixel';
  }

  // ── GA4 Measurement Protocol ───────────────────────────────
  if (env.GA4_API_SECRET && mid) {
    try {
      const params = {
        transaction_id: transaction,
        value,
        currency: currency || 'COP',
        items: [{ item_id: productId || undefined, item_name: productName || 'curso', quantity: 1, price: value }],
      };
      if (sck.gcl) params.gclid = sck.gcl;
      const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${mid}&api_secret=${env.GA4_API_SECRET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, non_personalized_ads: false, events: [{ name: 'purchase', params }] }),
      });
      results.ga4 = r.status < 300 ? 'ok' : `error:${r.status}`;
    } catch (e) {
      results.ga4 = `error:${e.message}`;
    }
  } else {
    results.ga4 = 'skipped:missing-secret-or-measurement-id';
  }

  const anyOk = String(results.capi).startsWith('ok') || String(results.ga4).startsWith('ok') || results.db === 'ok';
  return Response.json({ ok: anyOk, transaction, results }, { status: anyOk ? 200 : 502 });
}

export async function onRequestGet() {
  return Response.json({ service: 'hotmart-webhook', status: 'alive', version: 3 });
}
