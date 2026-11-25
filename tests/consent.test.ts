import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSENT_COOKIE, CONSENT_MAX_AGE_S, CONSENT_VERSION, consentFromCookieHeader, consentModeDefault, consentModeUpdate,
  parseConsent, serializeConsent,
} from '../src/lib/consent/format.ts';
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

test('Consent Mode: todo denegado por defecto en todas las regiones; el permiso se mapea por categoría', () => {
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
  assert.match(html, /\/legal\/privacidad\/#cookies/);
  assert.match(html, /<section id="sbc"[^>]*\shidden>/);
});
