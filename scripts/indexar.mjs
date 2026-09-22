/**
 * Pide a los buscadores que (re)rastreen una lista de URLs después de un deploy.
 *
 * Qué hace cada canal y qué NO se puede hacer:
 *
 * - IndexNow (Bing, Yandex, Naver, Seznam, Yep): sin cupo práctico, hasta
 *   10.000 URLs por envío. La clave vive en public/<clave>.txt. Solo tiene
 *   sentido para URLs que cambiaron: reenviar sin cambios no acelera nada.
 * - API de Bing Webmaster (SubmitUrlBatch): cupo de 100 URLs/día por sitio.
 *   El script recuerda lo ya enviado (ESTADO_BING) y cada día sigue donde lo
 *   dejó, así una lista de 250 se completa en tres corridas.
 * - Google: NO hay API para «Solicitar indexación». La Indexing API solo admite
 *   JobPosting y BroadcastEvent, y usarla para fichas de curso incumple sus
 *   condiciones. Lo único por API es reenviar el sitemap (Search Console); la
 *   solicitud URL por URL se hace a mano en la interfaz (~10 al día).
 *
 * Credenciales fuera del repo:
 *   ~/.config/connexis/bing-wmt-apikey      (o env BING_WMT_APIKEY)
 *   ~/.config/connexis/connexis-sa.json     (service account de Search Console)
 *
 * Uso:
 *   node scripts/indexar.mjs --lista urls.txt --indexnow --bing --sitemap-google
 *   node scripts/indexar.mjs --sitemap-google --feed https://sably.co/sitemaps/sitemap-temporal-ciudades-noindex.xml
 *     (--feed envía a Google sitemaps que NO están en sitemap-index.xml, como el
 *      temporal de las 504 páginas con noindex para Googlebot; se puede repetir)
 *   node scripts/indexar.mjs --lista urls.txt --bing --dry     (solo muestra el plan)
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createSign } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no .pathname: la ruta del proyecto lleva espacios.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = 'https://sably.co';
const CONFIG = path.join(os.homedir(), '.config/connexis');
const ESTADO_BING = path.join(CONFIG, 'sably-indexacion-bing.json');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const valor = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
const DRY = flag('--dry');

function leerLista() {
  const ruta = valor('--lista');
  if (!ruta) throw new Error('Falta --lista <archivo con una URL por línea>');
  const urls = readFileSync(path.resolve(ruta), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  // Solo URLs del propio sitio y sin duplicados: IndexNow rechaza el lote
  // entero (422) si una sola URL es de otro host.
  const propias = [...new Set(urls.filter((u) => u.startsWith(`${SITIO}/`)))];
  if (propias.length !== urls.length) {
    console.warn(`  ${urls.length - propias.length} líneas ignoradas (otro host o duplicadas)`);
  }
  return propias;
}

async function indexNow(urls) {
  const clave = readdirSync(path.join(RAIZ, 'public'))
    .map((f) => f.match(/^([0-9a-f]{32})\.txt$/)?.[1])
    .find(Boolean);
  if (!clave) throw new Error('No encuentro la clave IndexNow en public/<clave>.txt');
  const cuerpo = { host: 'sably.co', key: clave, keyLocation: `${SITIO}/${clave}.txt`, urlList: urls };
  if (DRY) return console.log(`  [dry] IndexNow: ${urls.length} URLs`);
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(cuerpo),
  });
  // 200 y 202 son aceptación; 422 suele ser una URL de otro host o la clave mal publicada.
  console.log(`  IndexNow: ${urls.length} URLs → HTTP ${r.status}`);
  if (r.status >= 400) console.log(`    ${(await r.text()).slice(0, 200)}`);
}

async function bing(urls) {
  const clave = process.env.BING_WMT_APIKEY ?? readFileSync(path.join(CONFIG, 'bing-wmt-apikey'), 'utf8').trim();
  const api = (metodo) => `https://ssl.bing.com/webmaster/api.svc/json/${metodo}?apikey=${clave}`;
  const estado = existsSync(ESTADO_BING) ? JSON.parse(readFileSync(ESTADO_BING, 'utf8')) : { enviadas: {} };
  const pendientes = urls.filter((u) => !estado.enviadas[u]);
  const q = await (await fetch(`${api('GetUrlSubmissionQuota')}&siteUrl=${encodeURIComponent(`${SITIO}/`)}`)).json();
  const cupo = Math.min(q.d?.DailyQuota ?? 0, q.d?.MonthlyQuota ?? 0);
  const lote = pendientes.slice(0, cupo);
  console.log(`  Bing: ${pendientes.length} pendientes, cupo hoy ${cupo} → envío ${lote.length}`);
  if (!lote.length || DRY) return;
  const r = await fetch(api('SubmitUrlBatch'), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ siteUrl: `${SITIO}/`, urlList: lote }),
  });
  console.log(`  Bing SubmitUrlBatch → HTTP ${r.status}`);
  if (r.ok) {
    const hoy = new Date().toISOString().slice(0, 10);
    for (const u of lote) estado.enviadas[u] = hoy;
    mkdirSync(CONFIG, { recursive: true });
    writeFileSync(ESTADO_BING, JSON.stringify(estado, null, 1));
    const faltan = pendientes.length - lote.length;
    if (faltan) console.log(`  Quedan ${faltan} para las próximas corridas (cupo diario).`);
  } else {
    console.log(`    ${(await r.text()).slice(0, 200)}`);
  }
}

async function sitemapGoogle() {
  const sa = JSON.parse(readFileSync(path.join(CONFIG, 'connexis-sa.json'), 'utf8'));
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const sinFirmar = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: sa.token_uri,
    iat: ahora,
    exp: ahora + 3600,
  })}`;
  const firma = createSign('RSA-SHA256').update(sinFirmar).sign(sa.private_key).toString('base64url');
  const tok = await (
    await fetch(sa.token_uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${sinFirmar}.${firma}`,
      }),
    })
  ).json();
  const sitio = encodeURIComponent('sc-domain:sably.co');
  // sitemap-index.xml siempre; los --feed extra son sitemaps fuera del índice.
  const feeds = [`${SITIO}/sitemap-index.xml`, ...args.flatMap((a, i) => (a === '--feed' ? [args[i + 1]] : []))];
  for (const f of feeds) {
    if (!f?.startsWith(`${SITIO}/`)) {
      console.warn(`  Google: se ignora el feed «${f}» (no es de ${SITIO})`);
      continue;
    }
    if (DRY) {
      console.log(`  [dry] Google: envío de ${f}`);
      continue;
    }
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${sitio}/sitemaps/${encodeURIComponent(f)}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${tok.access_token}` },
    });
    console.log(`  Google: envío de ${f} → HTTP ${r.status}`);
  }
}

// La lista solo hace falta para IndexNow y Bing: enviar sitemaps a Google no la usa.
const urls = flag('--indexnow') || flag('--bing') ? leerLista() : [];
if (urls.length) console.log(`${urls.length} URLs en la lista${DRY ? ' (modo --dry, no se envía nada)' : ''}`);
if (flag('--indexnow')) await indexNow(urls);
if (flag('--bing')) await bing(urls);
if (flag('--sitemap-google')) await sitemapGoogle();
if (!flag('--indexnow') && !flag('--bing') && !flag('--sitemap-google')) {
  console.log('Nada que hacer: añade --indexnow, --bing y/o --sitemap-google.');
}
