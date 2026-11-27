import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLegacyApi, type LegacyBindings } from './legacy-backend';

interface Query { sql: string; values: unknown[]; }

function database(resolve: (query: Query) => unknown = () => null) {
  const calls: Query[] = [];
  const db = {
    prepare(sql: string) {
      const query: Query = { sql, values: [] };
      return {
        bind(...values: unknown[]) { query.values = values; return this; },
        async first() { calls.push(query); return resolve(query); },
        async all() { calls.push(query); return { results: resolve(query) ?? [] }; },
        async run() { calls.push(query); return { success: true, meta: {changes:1} }; },
      };
    },
    async batch() { return []; },
  } as unknown as D1Database;
  return { db, calls };
}

const request = (path: string, method = 'GET', body?: unknown, headers?: HeadersInit) =>
  new Request(`https://dev.sably.co/api/${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const bindings = (db: D1Database): LegacyBindings => ({
  SABLY_ENVIRONMENT: 'development',
  SABLY_DB: db,
  SABLY_IP_SALT: 'isolated-test-salt',
});

test('refuses missing/production environment and the production hostname before querying D1', async () => {
  const { db, calls } = database();
  for (const environment of [undefined, 'production']) {
    const response = await dispatchLegacyApi(request('v1/config'), { ...bindings(db), SABLY_ENVIRONMENT: environment }, 'v1/config');
    assert.equal(response.status, 503);
  }
  const response = await dispatchLegacyApi(new Request('https://sably.co/api/v1/config'), bindings(db), 'v1/config');
  assert.equal(response.status, 503);
  assert.deepEqual(calls, []);
});

test('requires SABLY_DB and never falls back to the CMS DB or accepts the same binding', async () => {
  const { db, calls } = database();
  for (const env of [
    { SABLY_ENVIRONMENT: 'development', DB: db },
    { ...bindings(db), DB: db },
  ]) {
    const response = await dispatchLegacyApi(request('v1/config'), env, 'v1/config');
    assert.equal(response.status, 503);
  }
  assert.deepEqual(calls, []);
});

test('blocks webhook, recovery mail and Hotmart refresh without executing integrations', async () => {
  const { db, calls } = database();
  for (const path of ['hotmart-webhook', 'v1/abandonos-notify', 'v1/precios/refresca']) {
    const response = await dispatchLegacyApi(request(path, 'POST', {}), bindings(db), path);
    assert.equal(response.status, 503);
    assert.match((await response.json() as { error: string }).error, /deshabilitada/);
  }
  assert.deepEqual(calls, []);
});

test('routes exact paths, rejects unsupported methods and does not expose inherited object keys', async () => {
  const { db } = database();
  for (const path of ['admin/despliegue', 'v1/unknown', 'constructor', '__proto__']) {
    assert.equal((await dispatchLegacyApi(request(path), bindings(db), path)).status, 404);
  }
  const response = await dispatchLegacyApi(request('v1/pulso', 'POST', {}), bindings(db), 'v1/pulso');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});

test('preserves public pulse contract using only legacy D1, including trailing slash and HEAD', async () => {
  const legacy = database(() => ({ votes: 7, avg_rating: 4.5, distinct_ips: 6 }));
  const cms = database(() => { throw new Error('CMS DB must never be queried'); });
  const env = { ...bindings(legacy.db), DB: cms.db };
  const response = await dispatchLegacyApi(request('v1/pulso/?subject=blog:oficios'), env, 'v1/pulso/');
  assert.deepEqual(await response.json(), { votes: 7, avg: 4.5, publicable: true });
  assert.deepEqual(legacy.calls[0]?.values, ['blog:oficios']);
  assert.deepEqual(cms.calls, []);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  const head = await dispatchLegacyApi(request('v1/pulso?subject=blog:oficios', 'HEAD'), env, 'v1/pulso');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('keeps snapshot, subject seed, prices write and sales authentication in their existing handlers', async () => {
  const { db, calls } = database(() => []);
  const env = { ...bindings(db), SABLY_SNAPSHOT_TOKEN: 'dev-only-fixture' };
  for (const [path, method] of [['v1/snapshot', 'GET'], ['v1/subjects', 'POST'], ['v1/precios', 'POST'], ['v1/ventas', 'GET']]) {
    const response = await dispatchLegacyApi(request(path!, method!), env, path!);
    assert.equal(response.status, 401, path);
  }
  assert.deepEqual(calls, []);
  const response = await dispatchLegacyApi(request('v1/snapshot', 'GET', undefined, {
    authorization: 'Bearer dev-only-fixture',
  }), env, 'v1/snapshot');
  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
});

test('leads save consent and test data while injected production mail settings cannot send email', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  const { db, calls } = database(() => ({ count: 0 }));
  const env = {
    ...bindings(db),
    SABLY_RESEND_API_KEY: 'must-not-cross-the-bridge',
    SABLY_BREVO_API_KEY: 'must-not-cross-the-bridge',
    SABLY_NOTIFY_FROM: 'preview@example.invalid',
    SABLY_NOTIFY_EMAIL: 'test@example.invalid',
    RESEND_API_KEY: 'must-not-cross-the-bridge',
    BREVO_API_KEY: 'must-not-cross-the-bridge',
    NOTIFY_FROM: 'preview@example.invalid',
    NOTIFY_EMAIL: 'test@example.invalid',
    SNAPSHOT_TOKEN: 'must-not-cross-the-bridge',
  };
  const response = await dispatchLegacyApi(request('v1/leads', 'POST', {
    name: 'Persona de prueba', email: 'preview@example.invalid', consent_text: 'Autorización de prueba.',
    abierto_ms: 5000, course_interest: 'curso-de-barberia',
  }), env, 'v1/leads');
  assert.equal(response.status, 201);
  const payload = await response.json() as { guardado: boolean; correo: boolean; mensaje: string };
  assert.equal(payload.guardado, true);
  assert.equal(payload.correo, false);
  assert.match(payload.mensaje, /no envía correos/);
  assert.ok(calls.some((q) => q.sql.includes('INSERT INTO consent') && q.values.includes('Autorización de prueba.')));
  assert.ok(calls.some((q) => q.sql.includes('INSERT INTO lead')));
  assert.equal(outbound.mock.callCount(), 0);
});

test('missing consent and anti-abuse rejection do not write a lead', async () => {
  const { db, calls } = database();
  for (const body of [
    { name: 'Prueba', email: 'preview@example.invalid' },
    { name: 'Prueba', email: 'preview@example.invalid', consent_text: 'Prueba', trampa: 'bot' },
  ]) {
    const response = await dispatchLegacyApi(request('v1/leads', 'POST', body), bindings(db), 'v1/leads');
    assert.ok([400, 403].includes(response.status));
  }
  assert.deepEqual(calls, []);
});

test('unexpected database failure returns no database internals', async () => {
  const { db } = database(() => { throw new Error('sensitive-table-and-customer'); });
  const response = await dispatchLegacyApi(request('v1/pulso?subject=course:test'), bindings(db), 'v1/pulso');
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /sensitive-table-and-customer/);
});

const productionBindings = (db: D1Database): LegacyBindings => ({
  ...bindings(db), SABLY_ENVIRONMENT: 'production', SABLY_CMS_READY: 'true', SABLY_PRODUCTION_ACTIVATED: 'true',
});
const productionRequest = (path: string, method = 'GET', body?: unknown, headers?: HeadersInit) =>
  new Request(request(path, method, body, headers).url.replace('dev.sably.co', 'sably.co'), {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test('production requires both explicit activation flags, canonical host and isolated operational DB', async () => {
  const legacy = database(() => ({ votes: 7, avg_rating: 4.5, distinct_ips: 6 }));
  const cms = database(() => { throw new Error('CMS DB must never be queried'); });
  const active = { ...productionBindings(legacy.db), DB: cms.db };
  for (const flag of ['SABLY_CMS_READY', 'SABLY_PRODUCTION_ACTIVATED']) {
    for (const value of [undefined, 'false', 'TRUE', '1']) {
      assert.equal((await dispatchLegacyApi(productionRequest('v1/config'), { ...active, [flag]: value }, 'v1/config')).status, 503);
    }
  }
  for (const hostname of ['dev.sably.co', 'sably-emdash-production.workers.dev', 'localhost', 'sably.co.evil.invalid']) {
    assert.equal((await dispatchLegacyApi(new Request(`https://${hostname}/api/v1/config`), active, 'v1/config')).status, 503);
  }
  assert.equal((await dispatchLegacyApi(productionRequest('v1/config'), { ...active, DB: legacy.db }, 'v1/config')).status, 503);
  assert.equal((await dispatchLegacyApi(productionRequest('v1/config'), { ...active, SABLY_DB: undefined }, 'v1/config')).status, 503);
  assert.deepEqual(legacy.calls, []);
  const response = await dispatchLegacyApi(productionRequest('v1/pulso?subject=blog:test'), active, 'v1/pulso');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { votes: 7, avg: 4.5, publicable: true });
  assert.equal(response.headers.get('x-sably-environment'), 'production');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(cms.calls, []);
  assert.equal((await dispatchLegacyApi(new Request('https://www.sably.co/api/v1/pulso?subject=blog:test'), active, 'v1/pulso')).status, 200);
});

test('production authentication is mandatory before private queries and webhook actions', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  const { db, calls } = database();
  for (const token of [undefined, 'private-test-fixture']) {
    const env = { ...productionBindings(db), SABLY_SNAPSHOT_TOKEN: token };
    for (const [path, method] of [['v1/snapshot', 'GET'], ['v1/subjects', 'POST'], ['v1/precios', 'POST'], ['v1/ventas', 'GET'], ['v1/abandonos-notify', 'GET']]) {
      assert.equal((await dispatchLegacyApi(productionRequest(path!, method!), env, path!)).status, 401, path);
    }
  }
  for (const token of [undefined, '', ' ']) {
    const env = { ...productionBindings(db), SABLY_HOTMART_HOTTOK: token };
    assert.equal((await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {}), env, 'hotmart-webhook')).status, 503);
  }
  assert.equal((await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {}, { 'x-hotmart-hottok': 'wrong' }), {
    ...productionBindings(db), SABLY_HOTMART_HOTTOK: 'valid-fixture',
  }, 'hotmart-webhook')).status, 403);
  assert.deepEqual(calls, []);
  assert.equal(outbound.mock.callCount(), 0);
});

test('recovery HEAD probes never execute the side-effecting legacy GET', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  const { db, calls } = database();
  const response = await dispatchLegacyApi(productionRequest('v1/abandonos-notify?key=fixture', 'HEAD'), {
    ...productionBindings(db), SABLY_SNAPSHOT_TOKEN: 'fixture',
  }, 'v1/abandonos-notify');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(await response.text(), '');
  assert.deepEqual(calls, []);
  assert.equal(outbound.mock.callCount(), 0);
});

test('activated production uses the injected EmDash pipeline and does not promise visitor confirmation', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => {throw new Error('No direct provider HTTP requests');});
  const sent:any[]=[];
  const { db } = database(() => ({ count: 0 }));
  const response = await dispatchLegacyApi(productionRequest('v1/leads', 'POST', {
    name: 'Persona de prueba', email: 'preview@example.invalid', consent_text: 'Autorización de prueba.', abierto_ms: 5000,
  }), productionBindings(db), 'v1/leads', {notificationEmail:'team@example.invalid',send:async message=>{sent.push(message);}});
  assert.equal(response.status, 201);
  const payload=await response.json() as {correo:boolean;equipo_notificado:boolean;mensaje:string};
  assert.equal(payload.correo,false);assert.equal(payload.equipo_notificado,true);
  assert.doesNotMatch(payload.mensaje,/enviamos.*correo/);
  assert.equal(sent[0].to,'team@example.invalid');assert.equal(sent[0].replyTo,'preview@example.invalid');
  assert.equal(outbound.mock.callCount(),0);
});

test('production price refresh retains the registered-product gate and webhook strips provider errors', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => { throw new Error('upstream URL api_secret=private-fixture'); });
  const empty = database();
  assert.equal((await dispatchLegacyApi(productionRequest('v1/precios/refresca', 'POST', { slug: 'unregistered-course' }), productionBindings(empty.db), 'v1/precios/refresca')).status, 404);
  assert.equal(outbound.mock.callCount(), 0);
  const legacy = database();
  const response = await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {
    event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'test-transaction', status: 'APPROVED' } },
  }, { 'x-hotmart-hottok': 'hottok-fixture' }), {
    ...productionBindings(legacy.db), SABLY_HOTMART_HOTTOK: 'hottok-fixture', SABLY_GA4_API_SECRET: 'private-fixture', SABLY_GA4_MEASUREMENT_ID: 'G-FIXTURE',
  }, 'hotmart-webhook');
  assert.equal(response.status, 200);
  const payload = await response.json() as { results: { db: string; ga4: string } };
  assert.equal(payload.results.db, 'ok');
  assert.equal(payload.results.ga4, 'error');
  assert.doesNotMatch(JSON.stringify(payload), /private-fixture|api_secret/);
  assert.ok(legacy.calls.every(query => /hotmart_(eventos|atribucion)/.test(query.sql)));
  assert.equal(outbound.mock.callCount(), 1);
});

test('production tracking never uses fallback properties and requires each configured ID and secret', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  const { db } = database();
  for (const event of ['PURCHASE_APPROVED', 'PURCHASE_REFUNDED']) {
    for (const extra of [
      { SABLY_META_CAPI_TOKEN: 'meta-fixture', SABLY_GA4_API_SECRET: 'ga4-fixture' },
      { SABLY_META_CAPI_PIXEL_ID: 'test-pixel', SABLY_GA4_MEASUREMENT_ID: 'G-FIXTURE' },
    ]) {
      const response = await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {
        event, data: { purchase: { transaction: 'test-transaction', status: 'APPROVED' } },
      }, { 'x-hotmart-hottok': 'hottok-fixture' }), {
        ...productionBindings(db), SABLY_HOTMART_HOTTOK: 'hottok-fixture', ...extra,
      }, 'hotmart-webhook');
      assert.equal(response.status, 200);
    }
  }
  assert.equal(outbound.mock.callCount(), 0);
});

test('configured production tracking uses the Sably origin and recovery links stay on Sably', async (t) => {
  const requests: { url: string; body: Record<string, any> }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(init?.body as string) });
    return Response.json({ events_received: 1 });
  });
  const db = database(query => query.sql.includes('FROM hotmart_eventos') ? [{
    id: 'recovery-fixture', buyer_name: 'Synthetic person', buyer_email: 'preview@example.invalid', product_name: 'Synthetic course',
  }] : null);
  const env = { ...productionBindings(db.db), SABLY_HOTMART_HOTTOK: 'hottok-fixture',
    SABLY_META_CAPI_TOKEN: 'meta-fixture', SABLY_META_CAPI_PIXEL_ID: 'test-pixel',
    SABLY_GA4_API_SECRET: 'ga4-fixture', SABLY_GA4_MEASUREMENT_ID: 'G-FIXTURE',
    SABLY_SNAPSHOT_TOKEN: 'snapshot-fixture', SABLY_BREVO_API_KEY: 'mail-fixture', SABLY_NOTIFY_FROM: 'site@example.invalid',
  };
  assert.equal((await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {
    event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'test-transaction', status: 'APPROVED' } },
  }, { 'x-hotmart-hottok': 'hottok-fixture' }), env, 'hotmart-webhook')).status, 200);
  assert.equal(requests[0]?.body.data[0].event_source_url, 'https://sably.co/');
  assert.equal(new URL(requests[0]!.url).pathname, '/v23.0/test-pixel/events');
  assert.equal(new URL(requests[1]!.url).searchParams.get('measurement_id'), 'G-FIXTURE');
  const emails:any[]=[];
  assert.equal((await dispatchLegacyApi(productionRequest('v1/abandonos-notify?key=snapshot-fixture'), env, 'v1/abandonos-notify', {notificationEmail:'team@example.invalid',send:async message=>{emails.push(message);}})).status, 200);
  assert.match(emails[0]?.html, /href="https:\/\/sably\.co\//);
  assert.equal(emails[0]?.cc,undefined);assert.equal(requests.length,2);
  assert.doesNotMatch(JSON.stringify(requests), /academiadebelleza|1711030209407213|G-G7HV230BFJ/);
});

test('approved purchases reach the OpenAI Conversions API with the ChatGPT click and hashed buyer data', async (t) => {
  const requests: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return Response.json({ accepted_events: 1 });
  });
  const legacy = database();
  const response = await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {
    event: 'PURCHASE_APPROVED',
    data: {
      buyer: { email: ' Persona@Example.invalid ', name: 'José Pérez', checkout_phone: '3001234567' },
      product: { id: 123, name: 'Curso sintético' },
      purchase: {
        transaction: 'HP-FIXTURE', status: 'APPROVED', approved_date: Date.now() - 60_000,
        price: { value: 187430, currency_value: 'COP' }, checkout_country: { iso: 'CO', name: 'Colombia' },
        tracking: { source_sck: 'opp~oppref_fixture|obr~obref-fixture|cid~1.2' },
      },
    },
  }, { 'x-hotmart-hottok': 'hottok-fixture' }), {
    ...productionBindings(legacy.db), SABLY_HOTMART_HOTTOK: 'hottok-fixture',
    SABLY_OPENAI_PIXEL_ID: 'Q4xWyKhiMTwnc1PFCmKg7q', SABLY_OPENAI_CAPI_KEY: 'capi-fixture',
  }, 'hotmart-webhook');
  assert.equal(response.status, 200);
  const payload = await response.json() as { results: { openai: string; attribution: string } };
  assert.equal(payload.results.openai, 'ok:1:oppref');
  assert.equal(payload.results.attribution, 'opp,obr,cid');
  assert.equal(requests.length, 1);
  const url = new URL(requests[0]!.url);
  assert.equal(url.origin + url.pathname, 'https://bzr.openai.com/v1/events');
  assert.equal(url.searchParams.get('pid'), 'Q4xWyKhiMTwnc1PFCmKg7q');
  assert.equal((requests[0]!.init!.headers as Record<string, string>).authorization, 'Bearer capi-fixture');
  const body = JSON.parse(requests[0]!.init!.body as string);
  const event = body.events[0];
  assert.equal(event.id, 'hotmart.HP-FIXTURE');
  assert.equal(event.type, 'order_created');
  assert.equal(event.oppref, 'oppref_fixture');
  assert.equal(event.user.obref, 'obref-fixture');
  assert.deepEqual(event.data.amount, 18743000);
  assert.equal(event.data.currency, 'COP');
  assert.deepEqual(event.user.countries, ['CO']);
  assert.match(event.user.emails_sha256[0], /^[0-9a-f]{64}$/);
  assert.match(event.user.phone_numbers_sha256[0], /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(body), /Persona|example\.invalid|3001234567|José/);
  assert.ok(legacy.calls.some(query => query.sql.includes('hotmart_atribucion')));
  assert.ok(legacy.calls.some(query => query.sql.includes('hotmart_eventos')));
});

test('affiliate webhook without price or sck is completed from the Hotmart sales API before reaching OpenAI', async (t) => {
  const urls: string[] = [];
  let openaiBody: any;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); urls.push(url);
    if (url.includes('/security/oauth/token')) return Response.json({ access_token: 'hm-token' });
    if (url.includes('/sales/history')) return Response.json({ items: [{ purchase: {
      transaction: 'HP0000000001', approved_date: Date.now() - 30_000, price: { value: 187430, currency_code: 'COP' },
      tracking: { source: 'sably', source_sck: 'opp~gAAAA_fixture|obr~obref-fixture|cid~1.2' },
    } }] });
    if (url.startsWith('https://bzr.openai.com/')) { openaiBody = JSON.parse(init!.body as string); return Response.json({ accepted_events: 1 }); }
    throw new Error(`unexpected ${url}`);
  });
  const legacy = database();
  const affiliatePayload = { event: 'PURCHASE_APPROVED', data: { product: { id: 1933347, name: 'Curso' }, purchase: { transaction: 'HP0000000001', status: 'APPROVED' } } };
  const env = { ...productionBindings(legacy.db), SABLY_HOTMART_HOTTOK: 'hottok-fixture',
    SABLY_OPENAI_PIXEL_ID: 'Q4xWyKhiMTwnc1PFCmKg7q', SABLY_OPENAI_CAPI_KEY: 'capi-fixture',
    SABLY_HOTMART_CLIENT_ID: 'hm-id', SABLY_HOTMART_CLIENT_SECRET: 'hm-secret' };
  const response = await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', affiliatePayload, { 'x-hotmart-hottok': 'hottok-fixture' }), env, 'hotmart-webhook');
  const payload = await response.json() as { results: Record<string, string> };
  assert.equal(payload.results.hotmart, 'ok');
  assert.equal(payload.results.openai, 'ok:1:oppref');
  assert.equal(openaiBody.events[0].data.amount, 18743000);
  assert.equal(openaiBody.events[0].data.currency, 'COP');
  assert.equal(openaiBody.events[0].oppref, 'gAAAA_fixture');
  assert.equal(openaiBody.events[0].user.obref, 'obref-fixture');
  assert.ok(urls.some(u => u.includes('sales/history?transaction=HP0000000001')));
  const stored = legacy.calls.find(q => q.sql.includes('INTO hotmart_eventos'));
  assert.ok(stored?.values?.includes(187430), 'the purchase row keeps the value');
  const shape = legacy.calls.find(q => q.sql.includes('INSERT INTO hotmart_atribucion'));
  assert.ok(String(shape?.values?.at(-1)).includes('data.purchase.transaction'));
  assert.doesNotMatch(String(shape?.values?.at(-1)), /HP0000000001/, 'only key paths, never values');
});

test('without the Hotmart sale the OpenAI purchase is deferred instead of locked in without value', async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = String(input); urls.push(url);
    if (url.includes('/security/oauth/token')) return Response.json({ access_token: 'hm-token' });
    if (url.includes('/sales/history')) return Response.json({ items: [] });
    throw new Error(`unexpected ${url}`);
  });
  const legacy = database();
  const response = await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {
    event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'HP0000000002', status: 'APPROVED' } },
  }, { 'x-hotmart-hottok': 'hottok-fixture' }), { ...productionBindings(legacy.db), SABLY_HOTMART_HOTTOK: 'hottok-fixture',
    SABLY_OPENAI_PIXEL_ID: 'Q4xWyKhiMTwnc1PFCmKg7q', SABLY_OPENAI_CAPI_KEY: 'capi-fixture',
    SABLY_HOTMART_CLIENT_ID: 'hm-id', SABLY_HOTMART_CLIENT_SECRET: 'hm-secret' }, 'hotmart-webhook');
  const payload = await response.json() as { results: Record<string, string> };
  assert.equal(payload.results.openai, 'deferred:no-hotmart-sale');
  assert.ok(!urls.some(u => u.includes('bzr.openai.com')));
});

test('without Hotmart API credentials the webhook keeps sending the purchase as before', async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => { urls.push(String(input)); return Response.json({ accepted_events: 1 }); });
  const legacy = database();
  const response = await dispatchLegacyApi(productionRequest('hotmart-webhook', 'POST', {
    event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'HP0000000003', status: 'APPROVED' } },
  }, { 'x-hotmart-hottok': 'hottok-fixture' }), { ...productionBindings(legacy.db), SABLY_HOTMART_HOTTOK: 'hottok-fixture',
    SABLY_OPENAI_PIXEL_ID: 'Q4xWyKhiMTwnc1PFCmKg7q', SABLY_OPENAI_CAPI_KEY: 'capi-fixture' }, 'hotmart-webhook');
  const payload = await response.json() as { results: Record<string, string> };
  assert.equal(payload.results.hotmart, 'no-credentials');
  assert.equal(payload.results.openai, 'ok:1');
  assert.deepEqual(urls.map(u => new URL(u).host), ['bzr.openai.com']);
});
