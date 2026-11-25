#!/usr/bin/env node
/**
 * Barra de campaña del tema V2 en Chrome sin interfaz (solo lee; nunca paga).
 *
 *   node scripts/verificar-barra-campana.mjs --base https://sably.co
 *   node scripts/verificar-barra-campana.mjs --base http://localhost:4321 --paginas /co/,/co/cursos/ --anchos 390,1440
 *
 * Por página y ancho: «Copiar» deja el cupón en el portapapeles y dice «Copiado»; «×» cierra la
 * barra y la siguiente página de la misma sesión ya no la enseña; los enlaces que no son de
 * Hotmart (WhatsApp de homologaciones) no ganan `offDiscount`. Sale con código 1 si algo falla
 * (25-nov: en V2 ni copiaba ni se cerraba fuera de la ficha, porque nadie cargaba iniciarPromos).
 * Sin campaña vigente la barra no sale y la página se da por buena con un aviso.
 */
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = opcion('base', 'https://sably.co').replace(/\/$/, '');
const PAGINAS = opcion('paginas', '/co/,/co/cursos/,/mx/,/homologaciones/').split(',');
const ANCHOS = opcion('anchos', '390,1440').split(',').map(Number);
const CHROME = opcion('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const credenciales = process.env.SABLY_DEV_PASSWORD && !/^https:\/\/sably\.co$/.test(BASE) ? { username: 'sably', password: process.env.SABLY_DEV_PASSWORD } : null;
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
let fallos = 0;
for (const ancho of ANCHOS) for (const ruta of PAGINAS) {
  const contexto = await navegador.createBrowserContext();
  await contexto.overridePermissions(new URL(BASE).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const page = await contexto.newPage();
  if (credenciales) await page.authenticate(credenciales);
  await page.setUserAgent(UA);
  await page.setViewport({ width: ancho, height: ancho < 1024 ? 844 : 900, isMobile: ancho < 1024, hasTouch: ancho < 1024 });
  const url = `${BASE}${ruta}${ruta.includes('?') ? '&' : '?'}verif=${Date.now()}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 });
  await espera(600);
  const etiqueta = `${ruta} a ${ancho}`;
  const problemas = [];
  const barra = await page.$('[data-promo-v2="barra"]:not([hidden])');
  if (!barra) {
    console.log(`aviso ${etiqueta}: sin barra de campaña visible (¿no hay campaña vigente?)`);
    await contexto.close();
    continue;
  }
  const codigo = await page.$eval('[data-promo-v2="barra"] [data-promo-codigo]', (n) => n.textContent.trim());
  await page.click('[data-promo-v2="barra"] [data-promo-cupon]');
  await espera(300);
  const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  const rotulo = await page.$eval('[data-promo-v2="barra"] [data-promo-copiar-texto]', (n) => n.textContent.trim());
  if (copiado !== codigo) problemas.push(`«Copiar» dejó «${copiado ?? 'nada'}» en el portapapeles (cupón ${codigo})`);
  if (rotulo !== 'Copiado') problemas.push(`tras copiar el botón dice «${rotulo}»`);
  const sinHotmart = await page.evaluate(() => [...document.querySelectorAll('a[data-cta-hotmart]')]
    .filter((a) => { try { const u = new URL(a.href); return !/(^|\.)hotm(art)?\.(io|art|com)$/.test(u.hostname) && u.searchParams.has('offDiscount'); } catch { return false; } })
    .map((a) => a.href));
  if (sinHotmart.length) problemas.push(`enlaces que no son de Hotmart con offDiscount: ${sinHotmart.slice(0, 2).join(', ')}`);
  await page.click('[data-promo-v2="barra"] [data-promo-cerrar]');
  await espera(300);
  if (!(await page.$eval('[data-promo-v2="barra"]', (n) => n.hidden || getComputedStyle(n).display === 'none'))) problemas.push('«×» no cerró la barra');
  // La barra cerrada no vuelve en la siguiente página de la misma sesión (pestaña).
  await page.goto(url.replace(/verif=\d+/, `verif=${Date.now()}`), { waitUntil: 'networkidle2', timeout: 120_000 });
  await espera(800);
  if (await page.$('[data-promo-v2="barra"]:not([hidden])')) problemas.push('la barra cerrada volvió al recargar en la misma sesión');
  fallos += problemas.length ? 1 : 0;
  console.log(`${problemas.length ? 'FALLA' : 'ok   '} ${etiqueta}${problemas.length ? `: ${problemas.join('; ')}` : ` (cupón ${codigo} copiado y barra cerrada)`}`);
  await contexto.close();
}
await navegador.close();
console.log(fallos ? `\n${fallos} vistas con fallos.` : '\nBarra de campaña ok en todas las vistas.');
process.exit(fallos ? 1 : 0);
