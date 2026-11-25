#!/usr/bin/env node
/**
 * Verificación de la ficha V2 en Chrome sin interfaz (solo lee; nunca paga).
 *
 *   node scripts/verificar-ficha-v2.mjs --base https://sably.co --salida <carpeta>
 *   node scripts/verificar-ficha-v2.mjs --base https://dev.sably.co --salida <carpeta>   (con SABLY_DEV_PASSWORD)
 *
 * Por ficha y ancho (390 × 844 y 1440 × 900): captura del primer pantallazo y de la página
 * entera, posición del botón de pago, desbordamiento horizontal, quitar y reaplicar el cupón
 * (precio y enlaces a la vez), parámetros del enlace a Hotmart, teclado hasta «Quitar», barra
 * fija en móvil y frases del <main> del tema clásico que faltan en V2. Escribe resultados.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = opcion('base', 'https://sably.co').replace(/\/$/, '');
const SALIDA = opcion('salida', 'capturas');
const CHROME = opcion('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const FICHAS = (opcion('fichas', 'co/curso-de-masajes,mx/curso-de-unas-acrilicas,ec/curso-de-pasteleria,co/curso-de-soldadura,co/curso-de-tatuaje')).split(',');
const ANCHOS = [{ nombre: '390', width: 390, height: 844, isMobile: true, hasTouch: true }, { nombre: '1440', width: 1440, height: 900 }];
const entorno = new URL(BASE).hostname.split('.')[0] === 'sably' ? 'produccion' : new URL(BASE).hostname.split('.')[0];
const credenciales = process.env.SABLY_DEV_PASSWORD && !/^https:\/\/sably\.co$/.test(BASE) ? { username: 'sably', password: process.env.SABLY_DEV_PASSWORD } : null;
mkdirSync(SALIDA, { recursive: true });

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const resultados = [];

async function abrir(url, ancho) {
  const page = await navegador.newPage();
  if (credenciales) await page.authenticate(credenciales);
  await page.setViewport({ width: ancho.width, height: ancho.height, isMobile: !!ancho.isMobile, hasTouch: !!ancho.hasTouch, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 });
  await espera(800);
  return page;
}

/** Texto del <main>, plegado incluido (lo que lee un rastreador), en frases normalizadas. */
const textoMain = (page) => page.evaluate(() => {
  const main = document.querySelector('main');
  if (!main) return '';
  const copia = main.cloneNode(true);
  copia.querySelectorAll('script,style,template,svg').forEach((n) => n.remove());
  copia.querySelectorAll('p,li,h1,h2,h3,h4,dt,dd,summary,div,section,a,button,span,strong,figcaption,label').forEach((n) => n.prepend('\n'));
  return copia.textContent;
});
const norm = (s) => s.replace(/[^\p{L}\p{N}%.,:;¿?¡!()\-–—/ ]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

for (const ficha of FICHAS) {
  const clasico = await abrir(`${BASE}/${ficha}/?verif=${Date.now()}`, ANCHOS[1]);
  const textoClasico = await textoMain(clasico);
  await clasico.close();
  for (const ancho of ANCHOS) {
    const nombre = `${entorno}-${ficha.replace('/', '_')}-${ancho.nombre}`;
    const page = await abrir(`${BASE}/${ficha}/?tema=v2`, ancho);
    const r = { entorno, ficha, ancho: ancho.nombre };
    Object.assign(r, await page.evaluate(() => {
      const caja = document.querySelector('#compra');
      const boton = document.querySelector('#compra a[data-pago]') ?? document.querySelector('#compra [data-lead-open]');
      const b = boton?.getBoundingClientRect();
      return {
        tema: document.body.dataset.theme,
        robots: document.querySelector('meta[name="robots"]')?.content,
        canonica: document.querySelector('link[rel="canonical"]')?.href,
        preajuste: caja?.dataset.preajuste ?? null,
        estado: caja?.dataset.estado ?? null,
        botonTexto: boton?.textContent.replace(/\s+/g, ' ').trim(),
        botonFinal: b ? Math.round(b.bottom + scrollY) : null,
        botonSinDesplazar: b ? b.bottom + scrollY <= innerHeight : null,
        desborda: document.documentElement.scrollWidth > innerWidth,
        h1: document.querySelectorAll('h1').length,
      };
    }));
    await page.screenshot({ path: join(SALIDA, `${nombre}-pantallazo.jpg`), type: 'jpeg', quality: 70 });
    await page.screenshot({ path: join(SALIDA, `${nombre}-pagina.jpg`), type: 'jpeg', quality: 55, fullPage: true });

    // Enlace de pago y cupón.
    const enlaces = () => page.evaluate(() => [...document.querySelectorAll('a[data-pago]')].map((a) => {
      const u = new URL(a.href);
      return { posicion: a.dataset.ctaPosition, destino: u.origin + u.pathname, parametros: Object.fromEntries(u.searchParams), rel: a.rel, target: a.target };
    }));
    r.enlaces = await enlaces();
    if (await page.$('#compra [data-toggle]')) {
      const leer = () => page.evaluate(() => ({ cupon: document.querySelector('#compra').dataset.cupon, precio: document.querySelector('#compra [data-amount-cifra]')?.textContent, conCupon: [...document.querySelectorAll('a[data-pago]')].map((a) => new URL(a.href).searchParams.has('offDiscount')) }));
      const antes = await leer();
      const pulsar = async () => { await page.evaluate(() => document.querySelector('#compra [data-toggle]').scrollIntoView({ block: 'center' })); await espera(300); await page.click('#compra [data-toggle]'); };
      await pulsar();
      const quitado = await leer();
      await pulsar();
      const repuesto = await leer();
      r.cupon = { antes, quitado, repuesto, ok: antes.conCupon.every(Boolean) && quitado.conCupon.every((x) => !x) && repuesto.conCupon.every(Boolean) && antes.precio !== quitado.precio && antes.precio === repuesto.precio };
      // Teclado: Tab desde el principio hasta «Quitar» y Enter.
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      let pasos = 0;
      for (; pasos < 120; pasos++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => document.activeElement?.matches('#compra [data-toggle]'))) break;
      }
      const foco = await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { visible: s.outlineStyle !== 'none' || s.boxShadow !== 'none' }; });
      await page.keyboard.press('Enter');
      const trasEnter = await page.evaluate(() => document.querySelector('#compra').dataset.cupon);
      await page.keyboard.press('Enter');
      r.teclado = { tabsHastaQuitar: pasos + 1, focoVisible: foco.visible, enterQuita: trasEnter === 'retirado' };
    }
    // Barra fija (móvil y escritorio) al pasar la caja.
    if (await page.$('div[data-barra-fija]')) {
      await page.evaluate(() => document.getElementById('temario')?.scrollIntoView());
      await espera(900);
      r.barra = await page.evaluate(() => {
        const b = document.querySelector('div[data-barra-fija]');
        const rect = b.getBoundingClientRect();
        return { visible: !b.hasAttribute('data-oculta'), arriba: Math.round(rect.top), alto: Math.round(rect.height) };
      });
      await page.screenshot({ path: join(SALIDA, `${nombre}-barra.jpg`), type: 'jpeg', quality: 65 });
    }
    // Paridad de texto con el tema clásico.
    if (ancho.nombre === '1440') {
      const v2 = norm((await textoMain(page)).replace(/\n/g, ' '));
      const faltan = [];
      for (const linea of textoClasico.split('\n'))
        for (const frase of linea.split(/(?<=[.!?])\s+/)) {
          const n = norm(frase);
          if (n.length >= 3 && !v2.includes(n) && !faltan.includes(n)) faltan.push(n);
        }
      r.faltanEnV2 = faltan;
    }
    resultados.push(r);
    console.log(`${nombre}: ${r.preajuste ?? r.estado} botón ${r.botonFinal}px${r.botonSinDesplazar ? ' (sin desplazar)' : ''}${r.cupon ? ` cupón ${r.cupon.ok ? 'ok' : 'FALLA'}` : ''}${r.teclado ? ` teclado ${r.teclado.enterQuita ? 'ok' : 'FALLA'}` : ''}${r.barra ? ` barra ${r.barra.visible ? 'ok' : 'FALLA'}` : ''}${r.desborda ? ' DESBORDA' : ''}`);
    await page.close();
  }
}
writeFileSync(join(SALIDA, `resultados-${entorno}.json`), JSON.stringify({ base: BASE, fecha: new Date().toISOString(), resultados }, null, 1));
await navegador.close();
