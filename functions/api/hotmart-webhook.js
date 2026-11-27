/**
 * Webhook de Hotmart → D1 (base de compradores) + Meta CAPI + GA4 (macro conversión).
 *
 * v3 — persistencia: cada evento con datos de compra (aprobada, completa, reembolso,
 * chargeback, cancelada, abandono de carrito…) se guarda en D1 ANTES de reenviar,
 * con el nombre, correo, teléfono, país, producto, valor y la atribución sck
 * (fbp/fbc/cid/gclid) que adjunta el decorador de GTM. Los reintentos de Hotmart
 * no duplican (UNIQUE transaction+event). Los tests del panel no se guardan.
 *
 * v4 — ChatGPT Ads: cada compra aprobada va también a la Conversions API de OpenAI (order_created, id
 * `hotmart.<transacción>`, el mismo que Meta), con el clic de ChatGPT (`opp~`/`obr~` en el sck, lo añade el
 * píxel `oaiq` del sitio) y correo/teléfono/nombre en SHA-256. El sck se busca en todo el payload: Hotmart no
 * lo manda siempre en `purchase.origin.sck`. Tabla `hotmart_atribucion` (migración 0012) con el resultado.
 *
 * v5 — El webhook que Hotmart manda a Sably (afiliado) no trae precio, moneda, país, comprador ni sck (medido el
 * 26-nov: todas las filas vacías). Para las compras aprobadas/completas se completan valor, moneda y sck desde la API
 * de ventas de Hotmart (`sales/history?transaction=`) con HOTMART_CLIENT_ID/SECRET. Se guarda la forma del payload
 * (solo las rutas de las claves, sin valores) en `hotmart_atribucion.payload_claves` para poder revisarlo.
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

/**
 * El sck que Hotmart devuelve en la venta. El de la doc es `purchase.origin.sck`, pero la API de ventas lo da como
 * `tracking.source_sck` y el webhook no siempre lo trae ahí: se busca cualquier clave sck/source_sck del payload.
 */
export const findSck = (payload) => {
  const direct = payload?.data?.purchase?.origin?.sck ?? payload?.data?.purchase?.sck;
  if (typeof direct === 'string' && direct) return direct;
  const seen = new Set();
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return '';
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (/^(source_)?sck$/i.test(key) && typeof value === 'string' && value) return value;
    }
    for (const value of Object.values(node)) {
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return '';
  };
  return walk(payload, 0);
};

/** Rutas de las claves del payload, sin valores (para diagnosticar qué manda Hotmart sin guardar datos personales). */
export const payloadShape = (node, prefix = '', out = [], depth = 0) => {
  if (node && typeof node === 'object' && !Array.isArray(node) && depth < 6) {
    for (const [key, value] of Object.entries(node)) payloadShape(value, prefix ? `${prefix}.${key}` : key, out, depth + 1);
  } else if (prefix) out.push(prefix);
  return out;
};

/**
 * Venta según la API de Hotmart: precio, moneda y sck (`tracking.source_sck`). Dos intentos: la venta puede tardar
 * un instante en aparecer tras el webhook. Devuelve null sin credenciales o si no la encuentra. Cada llamada corta a
 * los 4 s (en total ≤ 14,5 s) para que una API de Hotmart lenta no deje colgado el webhook.
 */
export const hotmartSale = async (env, transaction, wait = (ms) => new Promise((r) => setTimeout(r, ms))) => {
  if (!env.HOTMART_CLIENT_ID || !env.HOTMART_CLIENT_SECRET || !/^HP/i.test(transaction)) return null;
  const basic = btoa(`${env.HOTMART_CLIENT_ID}:${env.HOTMART_CLIENT_SECRET}`);
  const auth = await fetch(`https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(env.HOTMART_CLIENT_ID)}&client_secret=${encodeURIComponent(env.HOTMART_CLIENT_SECRET)}`, {
    method: 'POST', headers: { authorization: `Basic ${basic}` }, signal: AbortSignal.timeout(4000),
  });
  const token = (await auth.json().catch(() => ({}))).access_token;
  if (!token) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await wait(2500);
    const r = await fetch(`https://developers.hotmart.com/payments/api/v1/sales/history?transaction=${encodeURIComponent(transaction)}`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000),
    });
    const item = (await r.json().catch(() => ({})))?.items?.[0];
    if (item?.purchase) {
      const p = item.purchase;
      return {
        value: Number(p.price?.value ?? 0),
        currency: String(p.price?.currency_code ?? '').toUpperCase(),
        sck: String(p.tracking?.source_sck ?? ''),
        source: String(p.tracking?.source ?? ''),
        approvedDate: Number(p.approved_date) || 0,
      };
    }
  }
  return null;
};

/**
 * Unidad menor ISO 4217, como pide la Conversions API de OpenAI (COP y USD: 2 decimales; CLP: 0). No se usa Intl:
 * su tabla CLDR da 0 decimales al COP.
 */
const ZERO_DECIMALS = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const THREE_DECIMALS = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
export const minorUnits = (value, currency) => {
  const digits = ZERO_DECIMALS.has(currency) ? 0 : THREE_DECIMALS.has(currency) ? 3 : 2;
  return Math.round(value * 10 ** digits);
};

/** Normalización de OpenAI para nombres: minúsculas, sin espacios ni puntuación ASCII; conserva tildes. */
const normName = (text) => String(text ?? '').toLowerCase().replace(/[\s!-/:-@[-`{-~]/g, '');

/** Teléfono con indicativo (8–15 cifras). Hotmart suele mandarlo sin él: se toma de checkout_phone_code o del país. */
export const normPhone = (raw, code, countryIso) => {
  let digits = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  const cc = String(code ?? '').replace(/\D/g, '');
  if (cc && cc.length <= 4 && !digits.startsWith(cc) && digits.length <= 11) digits = cc + digits;
  else if (!cc && countryIso === 'CO' && /^3\d{9}$/.test(digits)) digits = `57${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
};

/** El decorador de GTM arma: "fbp~..." | "fbc~..." | "cid~123.456" | "gcl~..."; el píxel de OpenAI añade "opp~" y "obr~". */
export const parseSck = (raw) => {
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
  let sckRaw = findSck(payload);
  const mid = env.GA4_MEASUREMENT_ID;

  const buyerEmail = String(data?.buyer?.email ?? '').trim().toLowerCase();
  const buyerName = String(data?.buyer?.name ?? '').trim();
  const buyerPhone = String(data?.buyer?.checkout_phone ?? data?.buyer?.phone ?? '').replace(/\D/g, '');
  let value = Number(purchase?.price?.value ?? purchase?.full_price?.value ?? 0);
  let currency = purchase?.price?.currency_value ?? purchase?.price?.currency_code ?? '';
  let approvedDate = Number(purchase?.approved_date) || null;
  const productName = data?.product?.name ?? '';
  const productId = String(data?.product?.id ?? '');
  const countryIso = String(purchase?.checkout_country?.iso ?? '').toUpperCase();
  const countryName = String(purchase?.checkout_country?.name ?? '');

  // Tests del panel de Hotmart: ni base de datos ni reenvío.
  if (buyerEmail.endsWith('@example.com') || /^testeComprador/i.test(buyerName)) {
    return Response.json({ ok: true, skipped: 'hotmart-test-payload' });
  }

  // Compras: lo que el webhook de afiliado no trae se completa con la API de ventas de Hotmart.
  const conversion = event === 'PURCHASE_APPROVED' || status === 'APPROVED' || status === 'COMPLETE';
  let enriched = 'not-needed';
  if (conversion && (!(value > 0) || !currency || !sckRaw) && !(env.HOTMART_CLIENT_ID && env.HOTMART_CLIENT_SECRET)) {
    // Sin credenciales se comporta como v4: envía lo que trae el webhook (aunque sea sin valor).
    enriched = 'no-credentials';
  } else if (conversion && (!(value > 0) || !currency || !sckRaw)) {
    try {
      const sale = await hotmartSale(env, transaction);
      enriched = sale ? 'ok' : 'unavailable';
      if (sale) {
        if (!(value > 0) && sale.value > 0) value = sale.value;
        if (!currency && sale.currency) currency = sale.currency;
        if (!sckRaw && sale.sck) sckRaw = sale.sck;
        if (!approvedDate && sale.approvedDate) approvedDate = sale.approvedDate;
      }
    } catch {
      enriched = 'error';
    }
  }
  const sck = parseSck(sckRaw);
  const clientId = /^\d+\.\d+$/.test(sck.cid ?? '') ? sck.cid : `hotmart.${transaction}`;

  const results = { db: null, capi: null, ga4: null, openai: null, hotmart: enriched, attribution: Object.keys(sck).join(',') || 'none' };

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
        approvedDate,
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

  // ── ChatGPT Ads · Conversions API de OpenAI ────────────────
  // Sin precio no se envía: OpenAI se queda con el primer evento de cada id y la compra quedaría sin valor para siempre.
  // Lo reenvía después el PURCHASE_COMPLETE o scripts/openai-capi-hotmart.mjs.
  if (env.OPENAI_CAPI_KEY && env.OPENAI_PIXEL_ID && !(value > 0) && (enriched === 'unavailable' || enriched === 'error')) {
    results.openai = 'deferred:no-hotmart-sale';
  } else if (env.OPENAI_CAPI_KEY && env.OPENAI_PIXEL_ID) {
    try {
      const user = {};
      if (buyerEmail) user.emails_sha256 = [await sha256(buyerEmail)];
      const phone = normPhone(data?.buyer?.checkout_phone ?? data?.buyer?.phone, data?.buyer?.checkout_phone_code, countryIso);
      if (phone) user.phone_numbers_sha256 = [await sha256(phone)];
      const [first, ...rest] = buyerName.split(/\s+/);
      const firstName = normName(data?.buyer?.first_name ?? first);
      const lastName = normName(data?.buyer?.last_name ?? rest.join(' '));
      if (firstName) user.first_names_sha256 = [await sha256(firstName)];
      if (lastName) user.last_names_sha256 = [await sha256(lastName)];
      if (/^[A-Z]{2}$/.test(countryIso)) user.countries = [countryIso];
      if (sck.obr) user.obref = sck.obr;
      const approved = approvedDate || 0;
      const now = Date.now();
      const money = /^[A-Z]{3}$/.test(currency) && value > 0 ? { amount: minorUnits(value, currency), currency } : {};
      const event = {
        id: `hotmart.${transaction}`,
        type: 'order_created',
        // La API acepta hasta 7 días atrás; un PURCHASE_COMPLETE tardío sale con la hora de llegada (el id deduplica).
        timestamp_ms: approved > now - 6.9 * 864e5 && approved < now + 6e5 ? approved : now,
        action_source: 'web',
        source_url: 'https://sably.co/',
        user,
        data: {
          type: 'contents',
          ...money,
          contents: [{ id: productId || 'curso', name: productName || 'curso', content_type: 'product', quantity: 1 }],
        },
      };
      if (sck.opp) event.oppref = sck.opp;
      const r = await fetch(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(env.OPENAI_PIXEL_ID)}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENAI_CAPI_KEY}`, 'content-type': 'application/json', 'user-agent': 'sably-hotmart-webhook' },
        body: JSON.stringify({ integration_source: 'sably-hotmart-webhook', events: [event] }),
      });
      const out = await r.json().catch(() => ({}));
      results.openai = r.ok ? `ok:${out.accepted_events ?? 1}${sck.opp ? ':oppref' : ''}` : `error:${r.status}:${JSON.stringify(out).slice(0, 160)}`;
    } catch (e) {
      results.openai = `error:${e.message}`;
    }
  } else {
    results.openai = 'skipped:missing-key-or-pixel';
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

  if (env.DB && (sckRaw || conversion || String(results.openai).match(/^(ok|error)/))) {
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS hotmart_atribucion (transaction_code TEXT PRIMARY KEY, sck TEXT, oppref TEXT,
         obref TEXT, openai TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      ).run();
      // Columna añadida en v5; en bases ya creadas se añade una vez (el error «duplicate column» se ignora).
      await env.DB.prepare('ALTER TABLE hotmart_atribucion ADD COLUMN payload_claves TEXT').run().catch(() => {});
      await env.DB.prepare(
        `INSERT INTO hotmart_atribucion (transaction_code, sck, oppref, obref, openai, payload_claves, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(transaction_code) DO UPDATE SET sck = COALESCE(excluded.sck, sck), oppref = COALESCE(excluded.oppref, oppref),
           obref = COALESCE(excluded.obref, obref), openai = CASE WHEN openai LIKE 'ok%' THEN openai ELSE excluded.openai END,
           payload_claves = COALESCE(excluded.payload_claves, payload_claves),
           updated_at = CURRENT_TIMESTAMP`,
      ).bind(transaction, sckRaw || null, sck.opp ?? null, sck.obr ?? null, String(results.openai ?? '').slice(0, 200) || null,
        payloadShape(payload).join(',').slice(0, 4000) || null).run();
    } catch (e) {
      results.attributionDb = `error:${String(e.message).slice(0, 120)}`;
    }
  }

  const anyOk = String(results.capi).startsWith('ok') || String(results.ga4).startsWith('ok') || String(results.openai).startsWith('ok') || results.db === 'ok';
  return Response.json({ ok: anyOk, transaction, results }, { status: anyOk ? 200 : 502 });
}

export async function onRequestGet() {
  return Response.json({ service: 'hotmart-webhook', status: 'alive', version: 5 });
}
