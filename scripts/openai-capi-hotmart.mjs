#!/usr/bin/env node
/**
 * Concilia las ventas de Hotmart con la Conversions API de ChatGPT Ads (OpenAI): lee la API de ventas de Hotmart
 * (últimos N días, máximo 7, que es lo que acepta OpenAI) y envía cada compra aprobada/completa como order_created
 * con el mismo id que el webhook (`hotmart.<transacción>`), así OpenAI se queda con la primera y descarta la otra.
 * Sirve de respaldo si un webhook falló y para validar la integración sin esperar una venta.
 *
 *   node scripts/openai-capi-hotmart.mjs              # validate_only: comprueba sin guardar
 *   node scripts/openai-capi-hotmart.mjs --enviar     # envía de verdad
 *   node scripts/openai-capi-hotmart.mjs --dias 3 --enviar
 *
 * Credenciales (nunca se imprimen): HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_BASIC en el entorno o en
 * ~/.config/connexis/marketing-secrets.env; la clave de la Conversions API en OPENAI_CAPI_KEY o
 * ~/.config/connexis/openai-ads-capi-key. Píxel: OPENAI_PIXEL_ID (por defecto el de sably.co).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseSck, minorUnits } from '../functions/api/hotmart-webhook.js';

const args = process.argv.slice(2);
const send = args.includes('--enviar');
const days = Math.min(7, Math.max(1, Number(args[args.indexOf('--dias') + 1]) || 7));
const PIXEL = process.env.OPENAI_PIXEL_ID || 'Q4xWyKhiMTwnc1PFCmKg7q';
const secretsFile = join(homedir(), '.config/connexis/marketing-secrets.env');
const fileEnv = existsSync(secretsFile)
  ? Object.fromEntries(readFileSync(secretsFile, 'utf8').split('\n').map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]))
  : {};
const cred = name => process.env[name] || fileEnv[name] || '';
const capiKey = process.env.OPENAI_CAPI_KEY || readFileSync(join(homedir(), '.config/connexis/openai-ads-capi-key'), 'utf8').trim();
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');

const tokenResponse = await fetch(`https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(cred('HOTMART_CLIENT_ID'))}&client_secret=${encodeURIComponent(cred('HOTMART_CLIENT_SECRET'))}`, {
  method: 'POST', headers: { authorization: `Basic ${cred('HOTMART_BASIC')}` },
});
const { access_token: token } = await tokenResponse.json();
if (!token) throw new Error(`Hotmart no dio token (HTTP ${tokenResponse.status})`);

const since = Date.now() - days * 864e5 + 10 * 60e3;
const sales = [];
let pageToken = '';
do {
  const url = new URL('https://developers.hotmart.com/payments/api/v1/sales/history');
  url.searchParams.set('max_results', '100');
  url.searchParams.set('start_date', String(since));
  url.searchParams.set('transaction_status', 'APPROVED,COMPLETE');
  if (pageToken) url.searchParams.set('page_token', pageToken);
  const page = await (await fetch(url, { headers: { authorization: `Bearer ${token}` } })).json();
  sales.push(...(page.items ?? []));
  pageToken = page.page_info?.next_page_token ?? '';
} while (pageToken);

const events = sales.flatMap(item => {
  const p = item.purchase ?? {};
  const when = Number(p.approved_date || p.order_date);
  if (!p.transaction || !(when > since)) return [];
  const sck = parseSck(p.tracking?.source_sck);
  const currency = String(p.price?.currency_code ?? '').toUpperCase();
  const value = Number(p.price?.value ?? 0);
  const email = String(item.buyer?.email ?? '').trim().toLowerCase();
  const event = {
    id: `hotmart.${p.transaction}`,
    type: 'order_created',
    timestamp_ms: when,
    action_source: 'web',
    source_url: 'https://sably.co/',
    user: { ...(email ? { emails_sha256: [sha(email)] } : {}), ...(sck.obr ? { obref: sck.obr } : {}) },
    data: {
      type: 'contents',
      ...(/^[A-Z]{3}$/.test(currency) && value > 0 ? { amount: minorUnits(value, currency), currency } : {}),
      contents: [{ id: String(item.product?.id ?? 'curso'), name: item.product?.name ?? 'curso', content_type: 'product', quantity: 1 }],
    },
  };
  if (sck.opp) event.oppref = sck.opp;
  return [event];
});

console.log(`${sales.length} ventas aprobadas/completas en ${days} días; ${events.length} eventos; ${events.filter(e => e.oppref).length} con clic de ChatGPT (oppref).`);
if (!events.length) process.exit(0);
const response = await fetch(`https://bzr.openai.com/v1/events?pid=${PIXEL}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${capiKey}`, 'content-type': 'application/json', 'user-agent': 'sably-capi-conciliacion' },
  body: JSON.stringify({ validate_only: !send, integration_source: 'sably-hotmart-webhook', events }),
});
console.log(`${send ? 'Enviado' : 'Validado (validate_only)'}: HTTP ${response.status}`, JSON.stringify(await response.json().catch(() => ({}))).slice(0, 300));
if (!response.ok) process.exit(1);
