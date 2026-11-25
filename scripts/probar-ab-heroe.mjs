#!/usr/bin/env node
/**
 * Prueba de la prueba A/B del héroe a través de una caché que entrega el MISMO HTML a todos (como el borde de
 * Cloudflare con «cache everything», que no varía por cookie). Pide la portada una vez al origen, guarda esos bytes y,
 * con puppeteer, se los sirve idénticos a N visitantes nuevos (contextos limpios, sin cookies). Cuenta qué variante
 * ve cada uno, que la conserve al recargar, que un bot vea la de control, que `?heroe_ab=` la fuerce y que no haya
 * salto de maquetación (CLS) al elegirla.
 *
 * Uso: node scripts/probar-ab-heroe.mjs --base http://127.0.0.1:4392 [--pais co] [--n 40]
 * Requisito: la prueba encendida en la base que sirve el origen (portadaHeroeAB = true).
 */
import { createHash } from 'node:crypto';
import puppeteer from 'puppeteer-core';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4392');
const PAIS = arg('pais', 'co');
const N = Number(arg('n', '40'));
const CHROME = arg('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const URL_PORTADA = `${BASE}/${PAIS}/`;

/* 1. El origen da el mismo HTML con y sin cookies de la prueba (no hay Set-Cookie ni variación por cookie). */
const pedir = async cookie => {
  const r = await fetch(URL_PORTADA, { headers: { 'user-agent': UA, ...(cookie ? { cookie } : {}) } });
  const html = await r.text();
  const heroe = html.slice(html.indexOf('<section class="v2-heroe'), html.indexOf('</section>', html.indexOf('<section class="v2-heroe')));
  return { html, setCookie: r.headers.get('set-cookie'), hash: createHash('sha1').update(heroe).digest('hex').slice(0, 12) };
};
const sin = await pedir('');
const con = await pedir('sably_ab_heroe=x%7Cbuscador; _ga=GA1.1.1');
console.log(`Origen: héroe sin cookie ${sin.hash}, con cookie ${con.hash} → ${sin.hash === con.hash ? 'IGUAL' : 'DISTINTO'}; Set-Cookie: ${sin.setCookie ?? 'ninguna'}`);
const m = sin.html.match(/data-heroe-ab="([^"]+)"/);
if (!m) { console.error('La prueba A/B no está encendida en esta base (no hay data-heroe-ab).'); process.exit(1); }
const ramas = [...sin.html.matchAll(/data-heroe-rama="([^"]+)"/g)].map(x => x[1]);
console.log(`Control en el HTML: ${m[1]}; ramas: ${ramas.join(', ')}; bytes del HTML: ${sin.html.length}`);

/* 2. «Borde» simulado: cada petición del documento recibe exactamente esos bytes. */
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', '--hide-scrollbars'] });
const visita = async (ctx, { ua = UA, query = '' } = {}) => {
  const page = await ctx.newPage();
  await page.setUserAgent(ua);
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', r => (r.isNavigationRequest() && r.url().startsWith(URL_PORTADA) ? r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: sin.html }) : r.continue()));
  await page.evaluateOnNewDocument(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(URL_PORTADA + query, { waitUntil: 'load', timeout: 60_000 });
  await new Promise(r => setTimeout(r, 400));
  const r = await page.evaluate(() => {
    const s = document.querySelector('[data-heroe]');
    const visibles = [...document.querySelectorAll('[data-heroe-rama]')].filter(x => [...x.children].some(c => c.checkVisibility())).map(x => x.getAttribute('data-heroe-rama'));
    return { heroe: s?.getAttribute('data-heroe'), visibles, cookie: document.cookie.match(/sably_ab_heroe=([^;]*)/)?.[1] ?? null, cls: window.__cls, eventos: (window.dataLayer ?? []).filter(e => e.event === 'experiment_impression').map(e => e.variant_id) };
  });
  await page.close();
  return r;
};

const cuenta = {};
let malas = 0, pegajosas = 0, clsMax = 0;
for (let i = 0; i < N; i++) {
  const ctx = await navegador.createBrowserContext();
  const a = await visita(ctx);
  const b = await visita(ctx);
  cuenta[a.heroe] = (cuenta[a.heroe] ?? 0) + 1;
  if (a.visibles.length !== 1 || a.visibles[0] !== a.heroe || a.eventos[0] !== a.heroe) malas++;
  if (b.heroe === a.heroe) pegajosas++;
  clsMax = Math.max(clsMax, a.cls, b.cls);
  await ctx.close();
}
console.log(`Visitantes nuevos: ${N}. Reparto: ${JSON.stringify(cuenta)}. Conservan la variante al recargar: ${pegajosas}/${N}. Rama visible ≠ elegida o sin experiment_impression: ${malas}. CLS máximo: ${clsMax.toFixed(4)}`);

const ctxBot = await navegador.createBrowserContext();
const bot = await visita(ctxBot, { ua: BOT });
console.log(`Bot (Googlebot): ${bot.heroe} (control: ${m[1]}) cookie: ${bot.cookie ?? 'ninguna'}`);
await ctxBot.close();
const otra = ramas.find(r => r !== m[1]);
const ctxQ = await navegador.createBrowserContext();
const q = await visita(ctxQ, { query: `?heroe_ab=${otra}` });
console.log(`?heroe_ab=${otra}: ${q.heroe}`);
await ctxQ.close();
await navegador.close();

const ok = sin.hash === con.hash && !sin.setCookie && Object.keys(cuenta).length === ramas.length && pegajosas === N && malas === 0 && clsMax < 0.001 && bot.heroe === m[1] && !bot.cookie && q.heroe === otra;
console.log(ok ? 'RESULTADO: la prueba reparte de verdad a través de una caché que entrega el mismo HTML a todos.' : 'RESULTADO: FALLA (ver arriba).');
process.exit(ok ? 0 : 1);
