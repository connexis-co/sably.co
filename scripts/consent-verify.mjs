// Verificación del consentimiento en Chrome real (puppeteer-core). Las balizas de medición se registran y se
// ABORTAN (no ensucian GA4/Meta/Clarity); los scripts de las etiquetas sí se cargan para ver qué hacen.
// Uso: node scripts/consent-verify.mjs <url|archivo.html> [--wait=6000]
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const target = process.argv[2];
const wait = Number((process.argv.find((a) => a.startsWith('--wait=')) ?? '--wait=6000').slice(7));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let url = target;
let server;
if (existsSync(target)) {
  const html = readFileSync(target);
  server = http.createServer((_q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(html); });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${server.address().port}/`;
}
const kind = (u) =>
  /clarity\.ms/.test(u) ? 'clarity' :
  /facebook\.(net|com)/.test(u) ? 'meta' :
  /google-analytics\.com|analytics\.google\.com|doubleclick\.net\/g\/|\/g\/collect|\/jsrs\/ag\/|googletagmanager\.com\/(gtm|gtag)/.test(u) ? 'google' : null;
const isBeacon = (u) => /\/g\/collect|\/g\/s\/collect|facebook\.com\/tr|clarity\.ms\/(collect|c\.gif)|b\.clarity\.ms|\/jsrs\/ag\/|ga-audiences/.test(u);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const results = [];
async function session(label, width, height, steps) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  let log = [];
  page.on('request', (r) => { const u = r.url(); const k = kind(u); if (k) log.push({ k, beacon: isBeacon(u), u: u.slice(0, 110), gcs: (u.match(/[?&]gcs=(G\d+)/) || [])[1] }); isBeacon(u) ? r.abort() : r.continue(); });
  await page.evaluateOnNewDocument(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const snap = async (name) => {
    await new Promise((r) => setTimeout(r, wait));
    const s = await page.evaluate(() => ({
      pixels: window.fbq?.getState ? Object.keys(window.fbq.getState().pixels || {}).length : 0, banner: !document.getElementById('sbc')?.hidden, cookie: (document.cookie.match(/sably_consent=([^;]*)/) || [])[1] || null,
      cookies: document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((c) => c && c !== 'sably_consent'), cls: +window.__cls.toFixed(4),
      dl: (window.dataLayer || []).slice(0, 6).map((x) => (x && x.length ? Array.from(x).slice(0, 2).join(':') : x.event || '?')).join(' | '),
    }));
    const by = (k, b) => log.filter((x) => x.k === k && (b === undefined || x.beacon === b)).length;
    results.push({ label, name, ...s, 'google(s/b)': `${by('google', false)}/${by('google', true)}`, 'meta(s/b)': `${by('meta', false)}/${by('meta', true)}`, 'clarity(s/b)': `${by('clarity', false)}/${by('clarity', true)}`, gcs: [...new Set(log.filter((x) => x.gcs).map((x) => x.gcs))].join('+') });
    log = [];
    return page;
  };
  await page.goto(url, { waitUntil: 'load' });
  await steps(page, snap);
  await ctx.close();
}
const click = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
for (const [w, h] of [[1440, 900], [390, 844]]) {
  await session(`${w}: rechaza`, w, h, async (p, snap) => {
    await snap('sin responder');
    await click(p, '[data-sbc=reject]'); await snap('tras Rechazar');
    await p.reload({ waitUntil: 'load' }); await snap('recarga tras rechazar');
  });
  await session(`${w}: acepta`, w, h, async (p, snap) => {
    await snap('sin responder');
    await click(p, '[data-sbc=accept]'); await snap('tras Aceptar');
    await p.reload({ waitUntil: 'load' }); await snap('recarga tras aceptar');
    await p.evaluate(() => document.querySelector('[data-sably-consent-open]').click());
    await p.evaluate(() => { document.getElementById('sbc-a').click(); }); // apaga medición
    await click(p, '[data-sbc=save]'); await snap('retira medición (queda publicidad)');
  });
}
await session('390: teclado', 390, 844, async (p, snap) => {
  await new Promise((r) => setTimeout(r, 1500));
  const order = [];
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => document.activeElement?.getAttribute('data-sbc') || document.activeElement?.tagName)); }
  await p.keyboard.press('Tab'); // pasa de largo
  await p.focus('[data-sbc=prefs]'); await p.keyboard.press('Enter');
  const open = await p.evaluate(() => document.getElementById('sbc-dlg').open);
  await p.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 300));
  const closed = await p.evaluate(() => !document.getElementById('sbc-dlg').open && !document.getElementById('sbc').hidden);
  await p.focus('[data-sbc=prefs]'); await p.keyboard.press('Enter');
  await p.focus('#sbc-m'); await p.keyboard.press('Space');
  const marked = await p.evaluate(() => [document.getElementById('sbc-a').checked, document.getElementById('sbc-m').checked]);
  await p.focus('[data-sbc=save]'); await p.keyboard.press('Enter');
  const ck = await p.evaluate(() => (document.cookie.match(/sably_consent=\d+\.(\d)\.(\d)/) || []).slice(1).join(''));
  results.push({ label: 'teclado 390', name: `Tab→${order.join(',')}; Enter abre=${open}; Esc cierra y el aviso vuelve=${closed}; Espacio marca [medición,publicidad]=${marked}; guarda cookie análisis/publicidad=${ck}` });
});
console.table(results.map(({ dl, cookie, ...r }) => r));
await browser.close(); server?.close();
