// Verificación del consentimiento en Chrome real (puppeteer-core). Las balizas de medición se registran y se
// ABORTAN (no ensucian GA4/Meta/Clarity); los scripts de las etiquetas sí se cargan para ver qué hacen.
// El país se simula respondiendo a /cdn-cgi/trace de Cloudflare (lo que usa el aviso para la excepción europea).
//
// Uso: node scripts/consent-verify.mjs <url|archivo.html> [--modo=discreto|completo|pie] [--pais=CO|ES|ninguno]
//        [--ruta=/es/curso/] [--wait=6000] [--capturas=<carpeta>]
//   --modo   el modo configurado en el panel para esa página (el guion no lo adivina; por defecto, discreto).
//   --pais   país que devuelve /cdn-cgi/trace; «ninguno» lo hace fallar (caída segura: Europa solo si la ruta es /es/).
//   --ruta   con un archivo, ruta desde la que se sirve (para probar la caída segura con /es/).
// Sale con código 1 si falla alguna comprobación.
import http from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback}`).slice(name.length + 3);
const target = process.argv[2];
const wait = Number(arg('wait', '6000'));
const mode = arg('modo', 'discreto');
const country = arg('pais', 'CO').toUpperCase();
const shots = arg('capturas', '');
const STRICT = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH', 'AX', 'GP', 'GF', 'MQ', 'RE', 'YT', 'MF'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let url = target;
let server;
if (existsSync(target)) {
  const html = readFileSync(target);
  server = http.createServer((_q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(html); });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  url = new URL(arg('ruta', '/'), `http://127.0.0.1:${server.address().port}/`).href;
}
const path = new URL(url).pathname;
const strict = mode === 'completo' || (country === 'NINGUNO' ? /^\/es(\/|$)/.test(path) : STRICT.includes(country));
if (shots) mkdirSync(shots, { recursive: true });
console.log(`Modo ${mode} · país ${country} · ruta ${path} → ${strict ? 'aviso completo (letrero y denegado)' : 'sin letrero y medido'}`);

const kind = (u) =>
  /clarity\.ms/.test(u) ? 'clarity' :
  /facebook\.(net|com)/.test(u) ? 'meta' :
  /google-analytics\.com|analytics\.google\.com|doubleclick\.net\/g\/|\/g\/collect|\/jsrs\/ag\/|googletagmanager\.com\/(gtm|gtag)/.test(u) ? 'google' : null;
const isBeacon = (u) => /\/g\/collect|\/g\/s\/collect|facebook\.com\/tr|clarity\.ms\/(collect|c\.gif)|b\.clarity\.ms|\/jsrs\/ag\/|ga-audiences/.test(u);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const results = [];
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ comprobación: name, resultado: pass ? 'OK' : 'FALLA', detalle: String(detail).slice(0, 120) }); };
let tagsSeen = false;

async function session(label, width, height, steps) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  let log = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/\/cdn-cgi\/trace$/.test(new URL(u).pathname)) {
      return country === 'NINGUNO' ? r.abort() : r.respond({ status: 200, contentType: 'text/plain', body: `fl=1\nh=${new URL(u).host}\nip=203.0.113.9\nloc=${country}\ntls=TLSv1.3\n` });
    }
    const k = kind(u);
    if (k) { tagsSeen = true; log.push({ k, beacon: isBeacon(u), u: u.slice(0, 110), gcs: (u.match(/[?&]gcs=(G\d+)/) || [])[1] }); }
    isBeacon(u) ? r.abort() : r.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const snap = async (name) => {
    await new Promise((r) => setTimeout(r, wait));
    const s = await page.evaluate(() => {
      const ico = document.getElementById('sbc-ico');
      const icoOn = !!ico && getComputedStyle(ico).visibility === 'visible' && getComputedStyle(ico).display !== 'none' && ico.getBoundingClientRect().width > 0;
      return {
        pixels: window.fbq?.getState ? Object.keys(window.fbq.getState().pixels || {}).length : 0, banner: !document.getElementById('sbc')?.hidden, icono: icoOn,
        cookie: (document.cookie.match(/sably_consent=([^;]*)/) || [])[1] || null,
        cookies: document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((c) => c && c !== 'sably_consent').join(' '), cls: +window.__cls.toFixed(4),
        consent: (window.dataLayer || []).filter((x) => x && x[0] === 'consent').map((x) => `${x[1]}:${x[2].analytics_storage}${x[2].region ? '@región' : ''}`).join(' '),
      };
    });
    const by = (k, b) => log.filter((x) => x.k === k && (b === undefined || x.beacon === b)).length;
    const row = { label, name, ...s, 'google(s/b)': `${by('google', false)}/${by('google', true)}`, 'meta(s/b)': `${by('meta', false)}/${by('meta', true)}`, 'clarity(s/b)': `${by('clarity', false)}/${by('clarity', true)}`, gcs: [...new Set(log.filter((x) => x.gcs).map((x) => x.gcs))].join('+') };
    results.push(row);
    log = [];
    if (shots) await page.screenshot({ path: `${shots}/${label.replace(/\W+/g, '-')}-${name.replace(/\W+/g, '-')}.png` });
    return row;
  };
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await steps(page, snap);
  await ctx.close();
}
const click = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
/** El icono no se monta sobre lo fijo (WhatsApp, barras de compra) a lo largo de la página, ni sobre un botón de compra en el primer pantallazo. */
async function overlap(p) {
  const hits = [];
  for (const frac of [0, 0.35, 0.7, 1]) {
    await p.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), frac);
    await new Promise((r) => setTimeout(r, 700));
    hits.push(...await p.evaluate((f) => {
      const ico = document.getElementById('sbc-ico');
      if (!ico || getComputedStyle(ico).visibility !== 'visible') return [];
      const a = ico.getBoundingClientRect();
      const sel = ['#sably-whatsapp', '[data-wa-float]', '.v2-fija-compra', '[data-barra-fija] a[data-pago]', '[data-sticky-cta]:not([data-oculta])', '[data-prueba-social]:not([hidden])', ...(f === 0 ? ['[data-cta-hotmart]', 'a[data-pago]'] : [])];
      const out = [];
      for (const el of document.querySelectorAll(sel.join(','))) {
        const st = getComputedStyle(el), b = el.getBoundingClientRect();
        if (st.display === 'none' || st.visibility === 'hidden' || !b.width || !b.height) continue;
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) out.push(`${Math.round(f * 100)} %: ${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`);
      }
      return out;
    }, frac));
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  return hits;
}

if (strict) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await session(`${w}: rechaza`, w, h, async (p, snap) => {
      const a = await snap('sin responder');
      ok(`${w} letrero visible sin responder`, a.banner);
      ok(`${w} icono escondido mientras se ve el letrero`, !a.icono);
      ok(`${w} Consent Mode denegado al entrar`, !a.gcs || /^G100/.test(a.gcs), a.gcs || a.consent);
      ok(`${w} Meta y Clarity retenidos`, a['meta(s/b)'] === '0/0' && a['clarity(s/b)'] === '0/0', `${a['meta(s/b)']} ${a['clarity(s/b)']}`);
      await click(p, '[data-sbc=reject]'); const b = await snap('tras Rechazar');
      ok(`${w} Rechazar guarda 1.0.0`, /^1\.0\.0\./.test(b.cookie ?? ''), b.cookie);
      ok(`${w} icono visible tras responder (modo discreto)`, mode !== 'discreto' || b.icono);
      await p.reload({ waitUntil: 'load', timeout: 120000 }); const c = await snap('recarga tras rechazar');
      ok(`${w} recarga: recuerda y no vuelve el letrero`, !c.banner && /^1\.0\.0\./.test(c.cookie ?? ''));
    });
    await session(`${w}: acepta`, w, h, async (p, snap) => {
      await snap('sin responder');
      await click(p, '[data-sbc=accept]'); const a = await snap('tras Aceptar');
      ok(`${w} Aceptar concede`, /^1\.1\.1\./.test(a.cookie ?? '') && (!tagsSeen || /G111/.test(a.gcs)), `${a.cookie} ${a.gcs}`);
      await p.reload({ waitUntil: 'load', timeout: 120000 }); await snap('recarga tras aceptar');
      await p.evaluate(() => document.querySelector('[data-sably-consent-open]').click());
      await p.evaluate(() => { document.getElementById('sbc-a').click(); }); // apaga medición
      await click(p, '[data-sbc=save]'); const b = await snap('retira medición (queda publicidad)');
      ok(`${w} retirar medición guarda 1.0.1 y borra _ga`, /^1\.0\.1\./.test(b.cookie ?? '') && !/(^| )_ga/.test(b.cookies), `${b.cookie} [${b.cookies}]`);
    });
  }
  await session('390: teclado', 390, 844, async (p) => {
    await new Promise((r) => setTimeout(r, 1500));
    await p.focus('[data-sbc=prefs]'); await p.keyboard.press('Enter');
    const open = await p.evaluate(() => document.getElementById('sbc-dlg').open);
    const off = await p.evaluate(() => !document.getElementById('sbc-a').checked && !document.getElementById('sbc-m').checked);
    await p.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 300));
    const closed = await p.evaluate(() => !document.getElementById('sbc-dlg').open && !document.getElementById('sbc').hidden);
    await p.focus('[data-sbc=prefs]'); await p.keyboard.press('Enter');
    await p.focus('#sbc-m'); await p.keyboard.press('Space');
    await p.focus('[data-sbc=save]'); await p.keyboard.press('Enter');
    const ck = await p.evaluate(() => (document.cookie.match(/sably_consent=\d+\.(\d)\.(\d)/) || []).slice(1).join(''));
    ok('teclado: Enter abre las preferencias con los interruptores apagados', open && off);
    ok('teclado: Escape cierra y el letrero vuelve', closed);
    ok('teclado: Espacio en Publicidad y Guardar → medición 0, publicidad 1', ck === '01', ck);
  });
} else {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await session(`${w}: sin letrero`, w, h, async (p, snap) => {
      const a = await snap('primera visita');
      ok(`${w} sin letrero`, !a.banner);
      ok(`${w} sin cookie de respuesta (no se decide por la persona)`, !a.cookie, a.cookie);
      ok(`${w} Consent Mode concedido por defecto`, /default:granted/.test(a.consent), a.consent);
      if (tagsSeen) {
        ok(`${w} GA4 sale concedido (gcs G111)`, /G111/.test(a.gcs) && !/G100/.test(a.gcs), a.gcs);
        ok(`${w} cookies de medición presentes`, /(^| )_ga/.test(a.cookies) && /_clck/.test(a.cookies), a.cookies);
        ok(`${w} Meta y Clarity cargan`, !a['meta(s/b)'].startsWith('0/') && !a['clarity(s/b)'].startsWith('0/'), `${a['meta(s/b)']} ${a['clarity(s/b)']}`);
      }
      ok(`${w} icono ${mode === 'discreto' ? 'visible' : 'ausente'}`, a.icono === (mode === 'discreto'));
      if (mode === 'discreto') { const hits = await overlap(p); ok(`${w} el icono no tapa WhatsApp, barras ni compra`, hits.length === 0, hits.join('; ')); }
      await p.evaluate((m) => document.querySelector(m === 'discreto' ? '#sbc-ico' : '[data-sably-consent-open]').click(), mode);
      const on = await p.evaluate(() => [document.getElementById('sbc-dlg').open, document.getElementById('sbc-a').checked, document.getElementById('sbc-m').checked]);
      ok(`${w} las preferencias abren con medición y publicidad encendidas`, on.every(Boolean), on);
      await p.evaluate(() => { document.getElementById('sbc-a').click(); });
      await click(p, '[data-sbc=save]'); const b = await snap('retira medición');
      ok(`${w} retirar medición guarda 1.0.1`, /^1\.0\.1\./.test(b.cookie ?? ''), b.cookie);
      ok(`${w} retirar medición pasa a denegado`, /update:denied/.test(b.consent), b.consent);
      if (tagsSeen) ok(`${w} retirar medición borra _ga y _clck`, !/(^| )_ga|_clck/.test(b.cookies), b.cookies);
      await p.reload({ waitUntil: 'load', timeout: 120000 }); const c = await snap('recarga tras retirar');
      ok(`${w} recarga: se recuerda (denegado, sin letrero)`, !c.banner && /^1\.0\.1\./.test(c.cookie ?? '') && /update:denied/.test(c.consent), c.consent);
      if (tagsSeen) ok(`${w} recarga: GA4 sin medición (G110) y sin _ga`, !/G111/.test(c.gcs) && !/(^| )_ga/.test(c.cookies), `${c.gcs} [${c.cookies}]`);
    });
  }
  await session('390: teclado', 390, 844, async (p) => {
    await new Promise((r) => setTimeout(r, 1500));
    const sel = mode === 'discreto' ? '#sbc-ico' : '[data-sably-consent-open]';
    let reached = false;
    for (let i = 0; i < 200 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate((s) => document.activeElement === document.querySelector(s), sel); }
    ok(`teclado: se llega con Tab a ${mode === 'discreto' ? 'el icono' : 'el enlace del pie'}`, reached);
    await p.focus(sel); await p.keyboard.press('Enter');
    const open = await p.evaluate(() => document.getElementById('sbc-dlg').open);
    await p.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 300));
    const back = await p.evaluate((s) => !document.getElementById('sbc-dlg').open && document.activeElement === document.querySelector(s) && document.getElementById('sbc').hidden, sel);
    ok('teclado: Enter abre las preferencias', open);
    ok('teclado: Escape cierra, el foco vuelve y no aparece letrero', back);
  });
}
console.table(results.map(({ cookie, consent, ...r }) => r));
console.table(checks);
await browser.close(); server?.close();
const failed = checks.filter((c) => c.resultado !== 'OK').length;
console.log(failed ? `${failed} comprobaciones fallan` : `Todas las comprobaciones pasan (${checks.length}).`);
process.exit(failed ? 1 : 0);
