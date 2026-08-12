/**
 * Webhook de Hotmart → Meta CAPI + GA4 Measurement Protocol (macro conversión server-side).
 *
 * v2 — mejoras tras la prueba de configuración del 2026-08-12:
 *  - Filtra los payloads de PRUEBA del panel (email @example.com / testeComprador).
 *  - Usa purchase.origin.sck para atribución real: el decorador de GTM adjunta
 *    fbp/fbc (Meta), client_id de GA4 y gclid al clic hacia Hotmart, y aquí se
 *    recuperan → matching determinista en Meta y sesión/fuente real en GA4.
 *  - checkout_country → user_data.country (hasheado) para mejor matching.
 *  - PURCHASE_REFUNDED / CHARGEBACK → evento `refund` en GA4 (ajusta ingresos).
 *
 * URL: https://sably.co/api/hotmart-webhook  ·  Registro: Hotmart → Herramientas → Webhook (2.0).
 * Vars en Pages: META_CAPI_TOKEN, GA4_API_SECRET (+ META_CAPI_PIXEL_ID, GA4_MEASUREMENT_ID,
 * HOTMART_HOTTOK, META_TEST_EVENT_CODE opcionales).
 */

const sha256 = async (text) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
  const mid = env.GA4_MEASUREMENT_ID || 'G-G7HV230BFJ';

  // Tests del panel de Hotmart: nunca reenviar a Meta/GA4.
  const buyerEmail = String(data?.buyer?.email ?? '');
  const buyerName = String(data?.buyer?.name ?? '');
  if (buyerEmail.endsWith('@example.com') || /^testeComprador/i.test(buyerName)) {
    return Response.json({ ok: true, skipped: 'hotmart-test-payload' });
  }

  // Reembolsos y contracargos → refund en GA4 (misma transacción) y fin.
  if (['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'].includes(event) || ['REFUNDED', 'CHARGEBACK'].includes(status)) {
    let ga4 = 'skipped:no-secret';
    if (env.GA4_API_SECRET) {
      const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${mid}&api_secret=${env.GA4_API_SECRET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name: 'refund', params: { transaction_id: transaction } }],
        }),
      });
      ga4 = r.status < 300 ? 'ok' : `error:${r.status}`;
    }
    return Response.json({ ok: true, refund: transaction, ga4 });
  }

  if (event !== 'PURCHASE_APPROVED' && status !== 'APPROVED' && status !== 'COMPLETE') {
    return Response.json({ ok: true, skipped: `${event}/${status}` });
  }

  const value = Number(purchase?.price?.value ?? purchase?.full_price?.value ?? 0);
  const currency = purchase?.price?.currency_value ?? purchase?.price?.currency_code ?? 'COP';
  const productName = data?.product?.name ?? 'curso';
  const productId = String(data?.product?.id ?? '');
  const email = buyerEmail.trim().toLowerCase();
  const phone = String(data?.buyer?.checkout_phone ?? data?.buyer?.phone ?? '').replace(/\D/g, '');
  const countryIso = String(data?.purchase?.checkout_country?.iso ?? '').trim().toLowerCase();

  const results = { capi: null, ga4: null, attribution: Object.keys(sck).join(',') || 'none' };

  // ── Meta CAPI ──────────────────────────────────────────────
  if (env.META_CAPI_TOKEN) {
    const pixel = env.META_CAPI_PIXEL_ID || '1711030209407213';
    const userData = {};
    if (email) userData.em = [await sha256(email)];
    if (phone) userData.ph = [await sha256(phone)];
    if (countryIso) userData.country = [await sha256(countryIso)];
    if (sck.fbp) userData.fbp = sck.fbp;
    if (sck.fbc) userData.fbc = sck.fbc;
    const body = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `hotmart.${transaction}`,
        action_source: 'website',
        event_source_url: 'https://academiadebelleza.edu.co/',
        user_data: userData,
        custom_data: {
          value,
          currency,
          content_name: productName,
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
    results.capi = 'skipped:no-token';
  }

  // ── GA4 Measurement Protocol ───────────────────────────────
  if (env.GA4_API_SECRET) {
    try {
      const params = {
        transaction_id: transaction,
        value,
        currency,
        items: [{ item_id: productId || undefined, item_name: productName, quantity: 1, price: value }],
      };
      if (sck.gcl) params.gclid = sck.gcl;
      const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${mid}&api_secret=${env.GA4_API_SECRET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          non_personalized_ads: false,
          events: [{ name: 'purchase', params }],
        }),
      });
      results.ga4 = r.status < 300 ? 'ok' : `error:${r.status}`;
    } catch (e) {
      results.ga4 = `error:${e.message}`;
    }
  } else {
    results.ga4 = 'skipped:no-secret';
  }

  const anyOk = String(results.capi).startsWith('ok') || String(results.ga4).startsWith('ok');
  return Response.json({ ok: anyOk, transaction, results }, { status: anyOk ? 200 : 502 });
}

export async function onRequestGet() {
  return Response.json({ service: 'hotmart-webhook', status: 'alive', version: 2 });
}
