import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSENT_COOKIE, CONSENT_MAX_AGE_S, CONSENT_STRICT_REGIONS, CONSENT_VERSION, consentFromCookieHeader, consentModeDefault,
  consentModeDefaults, consentModeUpdate, consentOptions, parseConsent, serializeConsent,
} from '../src/lib/consent/format.ts';
import { defaults, readConsentOptions, settingsSchema, validateUpdates } from '../src/plugins/sably-integrations/model.ts';
import { consentFragments } from '../src/lib/consent/index.ts';

const NOW = new Date('2026-11-25T12:00:00Z');
const at = Math.floor(NOW.getTime() / 1000);

test('el formato es el común con la academia: versión.medición.publicidad.fecha', () => {
  assert.equal(serializeConsent({ version: 1, analytics: true, ads: false, at: 1790000000.9 }), '1.1.0.1790000000');
  assert.deepEqual(parseConsent('1.0.1.1790000000'), { version: 1, analytics: false, ads: true, at: 1790000000 });
  for (const bad of ['', null, 'x', '1.2.0.1', '1.1.1', '1.1.1.1.1', '1.1.1.-4']) assert.equal(parseConsent(bad), null);
  assert.throws(() => serializeConsent({ version: 0, analytics: true, ads: true, at }));
});

test('la cookie se lee de la cabecera y vence, se rechaza si es futura o de otra versión', () => {
  const header = (v: string) => `a=1; ${CONSENT_COOKIE}=${v}; b=2`;
  assert.equal(consentFromCookieHeader(header(`${CONSENT_VERSION}.1.1.${at}`), { now: NOW })?.ads, true);
  assert.equal(consentFromCookieHeader(header(`1.1.1.${at - CONSENT_MAX_AGE_S - 1}`), { now: NOW }), null);
  assert.equal(consentFromCookieHeader(header(`1.1.1.${at + 3600}`), { now: NOW }), null);
  assert.equal(consentFromCookieHeader(header(`1.1.1.${at}`), { now: NOW, minVersion: 2 }), null);
  assert.equal(consentFromCookieHeader(null), null);
});

test('Consent Mode (aviso completo): todo denegado; el permiso se mapea por categoría', () => {
  const d = consentModeDefault();
  for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) assert.equal(d[k], 'denied');
  assert.equal(d.security_storage, 'granted');
  assert.deepEqual(consentModeUpdate({ analytics: true, ads: false }), {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted',
  });
});

test('el aviso sale con tres botones y sin casillas premarcadas; el script va primero y es JavaScript válido', () => {
  const [script, banner] = consentFragments(true);
  assert.equal(script.key, 'sably-consent');
  assert.equal(script.kind === 'inline-script' && (() => { new Function(script.code); return true; })(), true);
  const html = banner.kind === 'html' ? banner.html : '';
  for (const action of ['reject', 'prefs', 'accept']) assert.match(html, new RegExp(`data-sbc="${action}"`));
  assert.doesNotMatch(html, /\schecked[\s>=]/i);
  assert.doesNotMatch(html, /<h[1-6][\s>]/i, 'un encabezado antes del H1 rompe seo:test');
  assert.match(html, /\/legal\/privacidad\/#cookies/);
  assert.match(html, /<section id="sbc"[^>]*\shidden>/);
});

test('el aviso de cookies va al final del body (su H2 no queda antes del H1)', async () => {
  const { consentFragments } = await import('../src/lib/consent/index.ts');
  const banner = consentFragments(true).find((f) => f.key === 'sably-consent-banner');
  assert.equal(banner?.placement, 'body:end');
  assert.equal(consentFragments(true)[0]?.placement, 'head');
});

test('modo por defecto: discreto con la excepción europea; lo desconocido cae en el valor por defecto', async () => {
  assert.deepEqual(consentOptions(undefined, undefined), { mode: 'discreto', europe: true });
  assert.deepEqual(consentOptions('completo', false), { mode: 'completo', europe: false });
  assert.deepEqual(consentOptions('otro', 'sí'), { mode: 'discreto', europe: true });
  assert.equal(settingsSchema.consentNotice.default, 'discreto');
  assert.equal(settingsSchema.consentEurope.default, true);
  assert.equal(defaults.consentNotice, 'discreto');
  const unset = { get: async () => null };
  assert.deepEqual(await readConsentOptions(unset as never), { mode: 'discreto', europe: true });
  const saved = { get: async (k: string) => (k === 'consentNotice' ? 'pie' : false) };
  assert.deepEqual(await readConsentOptions(saved as never), { mode: 'pie', europe: false });
  const broken = { get: async (k: string) => (k === 'consentNotice' ? '<script>' : 'x') };
  assert.deepEqual(await readConsentOptions(broken as never), { mode: 'discreto', europe: true });
  assert.throws(() => validateUpdates({ consentNotice: 'nada' }));
  assert.throws(() => validateUpdates({ consentEurope: 'true' }));
  assert.deepEqual(validateUpdates({ consentNotice: 'completo', consentEurope: false }), { consentNotice: 'completo', consentEurope: false });
});

test('Consent Mode por modo: concedido global y denegado con region para el EEE, Reino Unido y Suiza', () => {
  const [full] = consentModeDefaults({ mode: 'completo', europe: true });
  assert.equal(consentModeDefaults({ mode: 'completo', europe: true }).length, 1);
  assert.equal(full?.analytics_storage, 'denied');
  assert.equal(full?.region, undefined);
  for (const mode of ['discreto', 'pie'] as const) {
    const [global, eu] = consentModeDefaults({ mode, europe: true });
    for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.equal(global?.[k], 'granted');
      assert.equal(eu?.[k], 'denied');
    }
    assert.equal(global?.region, undefined, 'la global no lleva region');
    assert.deepEqual(eu?.region, [...CONSENT_STRICT_REGIONS]);
    assert.equal(consentModeDefaults({ mode, europe: false }).length, 1);
  }
  for (const c of ['ES', 'DE', 'FR', 'IT', 'PT', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH']) assert.ok(CONSENT_STRICT_REGIONS.includes(c), c);
  for (const c of ['CO', 'MX', 'PE', 'EC', 'CL', 'AR', 'US']) assert.ok(!CONSENT_STRICT_REGIONS.includes(c), c);
  assert.equal(new Set(CONSENT_STRICT_REGIONS).size, CONSENT_STRICT_REGIONS.length);
  assert.equal(CONSENT_STRICT_REGIONS.filter((c) => /^[A-Z]{2}$/.test(c)).length, CONSENT_STRICT_REGIONS.length);
});

test('el icono flotante solo sale en el modo discreto; ningún modo pone un encabezado', () => {
  for (const mode of ['discreto', 'completo', 'pie'] as const) {
    const frags = consentFragments(true, { mode, europe: true });
    const html = frags.find((f) => f.key === 'sably-consent-banner');
    const text = html?.kind === 'html' ? html.html : '';
    assert.equal(/id="sbc-ico"/.test(text), mode === 'discreto', mode);
    assert.doesNotMatch(text, /<h[1-6][\s>]/i);
    const script = frags[0];
    assert.ok(script?.kind === 'inline-script' && (() => { new Function(script.code); return true; })());
  }
  const icon = consentFragments(true).find((f) => f.key === 'sably-consent-banner');
  const iconHtml = icon?.kind === 'html' ? icon.html : '';
  assert.match(iconHtml, /<button type="button" id="sbc-ico" data-sably-consent-open[^>]*aria-label="Preferencias de cookies"/);
  assert.ok(iconHtml.indexOf('id="sbc"') < iconHtml.indexOf('id="sbc-ico"'), 'el icono va después del aviso (selector ~)');
});
