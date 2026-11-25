/**
 * CLS de un artículo con huecos de publicidad (Chrome sin interfaz).
 * Uso: node scripts/medir-cls-publicidad.mjs --base http://127.0.0.1:4472 --url /blog/x/?tema=v2 [--consentimiento si|no|aceptar] [--salida dir]
 * «aceptar»: entra sin respuesta, hace scroll hasta la mitad y acepta en el aviso (los huecos de arriba no deben aparecer).
 * Red lenta (1,6 Mbps / 150 ms) y CPU ×4; scroll hasta el final; suma los layout-shift sin entrada reciente.
 */
import puppeteer from 'puppeteer-core';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4472'), URL_ = arg('url', '/blog/'), MODO = arg('consentimiento', 'si'), SALIDA = arg('salida', '');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REPETIR = Number(arg('repetir', '1'));
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const resultados = [];
for (let vuelta = 0; vuelta < REPETIR; vuelta++) for (const [ancho, alto] of [[390, 844], [1440, 900]]) {
  const contexto = await navegador.createBrowserContext();
  const pagina = await contexto.newPage();
  await pagina.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36');
  await pagina.setViewport({ width: ancho, height: alto, deviceScaleFactor: 1, isMobile: ancho < 768, hasTouch: ancho < 768 });
  const cdp = await pagina.createCDPSession();
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (MODO === 'si') await pagina.setCookie({ name: 'sably_consent', value: `1.1.1.${Math.floor(Date.now() / 1000)}`, url: BASE });
  await pagina.evaluateOnNewDocument(() => {
    window.__cls = 0; window.__shifts = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: e.value, n: (e.sources || []).map(s => s.node?.className || s.node?.nodeName).join(',') }); } }).observe({ type: 'layout-shift', buffered: true });
  });
  await pagina.goto(BASE + URL_, { waitUntil: 'load', timeout: 180_000 });
  const pasos = 12; let aceptados = null;
  for (let i = 1; i <= pasos; i++) {
    await pagina.evaluate((i, n) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * i / n), i, pasos);
    await new Promise(r => setTimeout(r, 400));
    if (MODO === 'aceptar' && i === Number(arg('aceptar-en', String(pasos / 2)))) aceptados = await pagina.evaluate(() => { window.sablyConsent?.set({ analytics: false, ads: true }); return [...document.querySelectorAll('.sably-ad')].map(h => `${h.dataset.hueco}:${h.hasAttribute('data-mostrar') ? 'aparece' : 'espera'}`); });
  }
  await new Promise(r => setTimeout(r, 1500));
  const r = await pagina.evaluate(() => ({
    cls: Number(window.__cls.toFixed(4)), shifts: window.__shifts.slice(0, 5),
    huecos: [...document.querySelectorAll('.sably-ad')].map(h => ({ pos: h.dataset.hueco, visible: h.getClientRects().length > 0, alto: Math.round(h.getBoundingClientRect().height) })),
    marca: document.documentElement.hasAttribute('data-sably-ads'), scriptGoogle: !!document.querySelector('script[src*="adsbygoogle"]'),
  }));
  if (SALIDA) await pagina.screenshot({ path: `${SALIDA}/${MODO}-${ancho}.png`, fullPage: true });
  resultados.push({ ancho, modo: MODO, aceptados, ...r });
  await contexto.close();
}
await navegador.close();
console.log(JSON.stringify(resultados, null, 1));
