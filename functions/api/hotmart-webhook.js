/**
 * Webhook de Hotmart (venta aprobada) → Meta CAPI + GA4 Measurement Protocol.
 *
 * Macro conversión real de la red Sably (academiadebelleza.edu.co · sably.co ·
 * cursodeglobosonline.com): Hotmart llama este endpoint cuando una compra queda
 * APROBADA y desde aquí se reporta server-side, inmune a bloqueadores/iOS.
 *
 * URL: https://sably.co/api/hotmart-webhook
 * Registrar en Hotmart: Herramientas → Webhook (versión 2.0), evento "Compra aprobada".
 *
 * Variables (Cloudflare Pages → Settings → Environment variables, producción):
 *  - META_CAPI_TOKEN     token de system user con acceso al dataset (obligatoria)
 *  - META_CAPI_PIXEL_ID  dataset/píxel; default 1711030209407213
 *  - GA4_MEASUREMENT_ID  default G-G7HV230BFJ (academiadebelleza)
 *  - GA4_API_SECRET      secret de Measurement Protocol (obligatoria para GA4)
 *  - HOTMART_HOTTOK      si está definida, se exige el header X-HOTMART-HOTTOK igual
 *  - META_TEST_EVENT_CODE opcional: enruta los eventos al Test Events de Meta
 */

const sha256 = async (text) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
  if (event !== 'PURCHASE_APPROVED' && status !== 'APPROVED' && status !== 'COMPLETE') {
    return Response.json({ ok: true, skipped: `${event}/${status}` });
  }

  const transaction = purchase.transaction ?? `hm-${Date.now()}`;
  const value = Number(purchase?.price?.value ?? purchase?.full_price?.value ?? 0);
  const currency = purchase?.price?.currency_value ?? purchase?.price?.currency_code ?? 'COP';
  const productName = data?.product?.name ?? 'curso';
  const email = (data?.buyer?.email ?? '').trim().toLowerCase();
  const phoneRaw = data?.buyer?.checkout_phone ?? data?.buyer?.phone ?? '';
  const phone = String(phoneRaw).replace(/\D/g, '');

  const results = { capi: null, ga4: null };

  // ── Meta CAPI ──────────────────────────────────────────────
  if (env.META_CAPI_TOKEN) {
    const pixel = env.META_CAPI_PIXEL_ID || '1711030209407213';
    const userData = {};
    if (email) userData.em = [await sha256(email)];
    if (phone) userData.ph = [await sha256(phone)];
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
    const mid = env.GA4_MEASUREMENT_ID || 'G-G7HV230BFJ';
    try {
      const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${mid}&api_secret=${env.GA4_API_SECRET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: `hotmart.${transaction}`,
          non_personalized_ads: false,
          events: [{
            name: 'purchase',
            params: {
              transaction_id: transaction,
              value,
              currency,
              items: [{ item_name: productName, quantity: 1, price: value }],
            },
          }],
        }),
      });
      // MP responde 204 sin body cuando acepta
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
  return Response.json({ service: 'hotmart-webhook', status: 'alive' });
}
