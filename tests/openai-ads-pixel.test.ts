import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { defaults, validateUpdates, trackingFragments, resolveIntegrationBindings, openaiPixelScript } from '../src/plugins/sably-integrations/model';
import { findSck, minorUnits, normPhone } from '../functions/api/hotmart-webhook.js';

const PIXEL = 'Q4xWyKhiMTwnc1PFCmKg7q';
const reader = (values: Record<string, unknown>) => ({ async get<T>(key: string) { return (values[key] ?? null) as T | null; } });

test('OpenAI pixel ID is validated and installed in production regardless of the GA4/Meta mode', () => {
  assert.throws(() => validateUpdates({ openaiPixelId: "Q4x';alert(1)//" }));
  assert.deepEqual(validateUpdates({ openaiPixelId: ` ${PIXEL} ` }), { openaiPixelId: PIXEL });
  for (const browserMode of ['off', 'gtm', 'direct'] as const) {
    const out = trackingFragments({ ...defaults, browserMode, gtmId: 'GTM-ABCDEFGH', openaiPixelId: PIXEL }, true);
    const pixel = out.filter(f => f.key === 'sably-openai-pixel');
    assert.equal(pixel.length, 1);
    assert.equal(out[0]?.key, 'sably-openai-pixel', 'the pixel goes before Tag Manager');
  }
  assert.deepEqual(trackingFragments({ ...defaults, openaiPixelId: PIXEL }, false), []);
  assert.deepEqual(trackingFragments({ ...defaults, browserMode: 'off', openaiPixelId: 'bad id!' }, true), []);
});

test('Conversions API key comes from the CMS or the .env and only with a pixel ID', async () => {
  const bindings = { SABLY_ENVIRONMENT: 'production', SABLY_CMS_READY: 'true', SABLY_PRODUCTION_ACTIVATED: 'true', SABLY_OPENAI_CAPI_KEY: 'ENV_KEY' };
  const url = 'https://sably.co/api/hotmart-webhook';
  const cms = await resolveIntegrationBindings(bindings, url, reader({ openaiPixelId: PIXEL, openaiCapiKey: 'CMS_KEY' }));
  assert.equal(cms.SABLY_OPENAI_CAPI_KEY, 'CMS_KEY'); assert.equal(cms.SABLY_OPENAI_PIXEL_ID, PIXEL);
  const env = await resolveIntegrationBindings(bindings, url, reader({ openaiPixelId: PIXEL }));
  assert.equal(env.SABLY_OPENAI_CAPI_KEY, 'ENV_KEY');
  const none = await resolveIntegrationBindings(bindings, url, reader({ openaiCapiKey: 'CMS_KEY' }));
  assert.equal(none.SABLY_OPENAI_PIXEL_ID, undefined); assert.equal(none.SABLY_OPENAI_CAPI_KEY, undefined);
});

/** Minimal browser: enough DOM for the inline snippet (queue, script injection, events, link decoration). */
function browser(cookie: string, consent: { analytics: boolean; ads: boolean } | null | undefined) {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  const injected: string[] = [];
  const head = { appendChild(el: any) { injected.push(el.src); } };
  const first = { parentNode: { insertBefore(el: any) { injected.push(el.src); } } };
  const document = {
    cookie, head,
    createElement: () => ({}),
    getElementsByTagName: () => [first],
    addEventListener(type: string, fn: (e: any) => void) { (listeners[type] ??= []).push(fn); },
  };
  const window: any = { location: { pathname: '/co/curso-de-maquillaje/' } };
  if (consent !== undefined) window.sablyConsent = { get: () => consent };
  runInNewContext(openaiPixelScript(PIXEL), { window, document, location: window.location, URL });
  const fire = (type: string, detail?: unknown, target?: unknown) => (listeners[type] ?? []).forEach(fn => fn({ detail, target }));
  const queue = () => JSON.parse(JSON.stringify(window.oaiq.q.map((a: IArguments) => Array.from(a)))) as unknown[][];
  return { window, injected, fire, queue };
}

test('pixel queues init and page_viewed but downloads the SDK only with advertising consent', () => {
  const pending = browser('', null);
  assert.deepEqual(pending.queue().map(a => a[0]), ['init', 'measure']);
  assert.equal((pending.queue()[0]![1] as { pixelId: string }).pixelId, PIXEL);
  assert.equal(pending.queue()[1]![1], 'page_viewed');
  assert.equal(pending.injected.length, 0, 'unknown consent: no SDK yet');
  pending.fire('sably:consent-ready', { analytics: true, ads: true });
  assert.deepEqual(pending.injected, ['https://bzrcdn.openai.com/sdk/oaiq.min.js']);
  pending.fire('sably:consent', { analytics: true, ads: false });
  assert.deepEqual(pending.queue().at(-1), ['consent', false]);
  pending.fire('sably:consent', { analytics: true, ads: true });
  assert.deepEqual(pending.queue().at(-1), ['consent', true]);
  assert.equal(pending.injected.length, 1);

  const denied = browser('', { analytics: true, ads: false });
  denied.fire('sably:consent-ready', { analytics: false, ads: false });
  assert.equal(denied.injected.length, 0);
  assert.equal(browser('', { analytics: true, ads: true }).injected.length, 1);
});

test('Hotmart links carry the ChatGPT click and keep the GTM attribution format', () => {
  const b = browser('_ga=GA1.1.111.222; __oppref=opp_ABC; __obref=123e4567-e89b-42d3-a456-426614174000', { analytics: true, ads: true });
  const link = (href: string) => { const a = { href }; return { a, target: { closest: () => a } }; };
  const fresh = link('https://hotm.io/curso?src=sably&offDiscount=031016');
  b.fire('mousedown', undefined, fresh.target);
  const sck = new URL(fresh.a.href).searchParams.get('sck');
  assert.equal(sck, 'opp~opp_ABC|obr~123e4567-e89b-42d3-a456-426614174000|cid~111.222');
  assert.equal(new URL(fresh.a.href).searchParams.get('offDiscount'), '031016');
  b.fire('click', undefined, fresh.target);
  assert.equal(new URL(fresh.a.href).searchParams.get('sck'), sck, 'idempotent');
  const gtm = link('https://pay.hotmart.com/X?sck=fbp~fb.1.2.3%7Ccid~9.9');
  b.fire('click', undefined, gtm.target);
  assert.equal(new URL(gtm.a.href).searchParams.get('sck'), 'opp~opp_ABC|obr~123e4567-e89b-42d3-a456-426614174000|fbp~fb.1.2.3|cid~9.9');
  const other = link('https://sably.co/co/');
  b.fire('click', undefined, other.target);
  assert.equal(other.a.href, 'https://sably.co/co/');
  const noClick = browser('_ga=GA1.1.1.2', { analytics: true, ads: true });
  const plain = link('https://hotm.io/curso');
  noClick.fire('mousedown', undefined, plain.target);
  assert.equal(plain.a.href, 'https://hotm.io/curso', 'without a ChatGPT click GTM keeps doing its own sck');
});

test('webhook helpers: sck anywhere in the payload, minor units and phone with country code', () => {
  assert.equal(findSck({ data: { purchase: { origin: { sck: 'cid~1.2' } } } }), 'cid~1.2');
  assert.equal(findSck({ data: { purchase: { tracking: { source_sck: 'opp~X' } } } }), 'opp~X');
  assert.equal(findSck({ data: { purchase: {} } }), '');
  assert.equal(minorUnits(187430, 'COP'), 18743000);
  assert.equal(minorUnits(19.9, 'USD'), 1990);
  assert.equal(minorUnits(25000, 'CLP'), 25000);
  assert.equal(normPhone('300 123 4567', '', 'CO'), '573001234567');
  assert.equal(normPhone('3001234567', '57', 'CO'), '573001234567');
  assert.equal(normPhone('5215512345678', '', 'MX'), '5215512345678');
  assert.equal(normPhone('123', '', 'CO'), '');
});
