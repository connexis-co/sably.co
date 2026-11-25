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
 * fija en móvil, «Disponible online en {país}» con las mismas ciudades que el clásico y sin enlaces,
 * y frases del <main> del tema clásico (?tema=clasico) que faltan en V2. Escribe resultados.json.
 *
 * Solapes (también a 768 × 1024): baja hasta el final y sube por tramos hasta arriba del todo,
 * con la barra de campaña abierta y, si la hay, cerrada; en cada parada compara los rectángulos
 * pintados de cabecera, barra de campaña, navegación interna, barra de compra y burbuja de WhatsApp. Sale con código 1
 * si alguno se monta sobre otro (25-nov: las pestañas quedaban pintadas encima del logo y del menú).
 *
 *   --fichas co/curso-de-masajes,...   --anchos 390,768,1440   --solo-solapes (sin capturas ni cupón)
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
const TODOS_LOS_ANCHOS = [{ nombre: '390', width: 390, height: 844, isMobile: true, hasTouch: true }, { nombre: '768', width: 768, height: 1024, isMobile: true, hasTouch: true }, { nombre: '1440', width: 1440, height: 900 }];
const ANCHOS = TODOS_LOS_ANCHOS.filter((a) => opcion('anchos', '390,768,1440').split(',').includes(a.nombre));
const SOLO_SOLAPES = args.includes('--solo-solapes');
const entorno = new URL(BASE).hostname.split('.')[0] === 'sably' ? 'produccion' : new URL(BASE).hostname.split('.')[0];
const credenciales = process.env.SABLY_DEV_PASSWORD && !/^https:\/\/sably\.co$/.test(BASE) ? { username: 'sably', password: process.env.SABLY_DEV_PASSWORD } : null;
mkdirSync(SALIDA, { recursive: true });

const UA_ESCRITORIO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const UA_MOVIL = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const resultados = [];

async function abrir(url, ancho) {
  const page = await navegador.newPage();
  if (credenciales) await page.authenticate(credenciales);
  // El nginx del servidor responde 403 a «HeadlessChrome»: agente de Chrome normal.
  await page.setUserAgent(ancho.isMobile ? UA_MOVIL : UA_ESCRITORIO);
  await page.setViewport({ width: ancho.width, height: ancho.height, isMobile: !!ancho.isMobile, hasTouch: !!ancho.hasTouch, deviceScaleFactor: 1 });
  // El Worker de dev.sably.co a veces responde un error suelto: hasta tres intentos.
  for (let intento = 1; intento <= 3; intento++) {
    const respuesta = await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 }).catch(() => null);
    await espera(800);
    if (respuesta?.ok() && (await page.$('body[data-theme]'))) break;
    if (intento === 3) console.error(`${url}: ${respuesta?.status() ?? 'sin respuesta'} tras 3 intentos`);
  }
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
/**
 * Piezas fijas de la ficha que no pueden montarse unas sobre otras. Cuenta lo que se PINTA:
 * un elemento con `visibility: visible` dentro de un padre `hidden` se ve igual, así que se mira la
 * visibilidad calculada de cada pieza, no la de su contenedor.
 */
const PIEZAS = { cabecera: '[data-cabecera]', campana: '[data-promo-v2="barra"]', barra: '[data-barra-fija]', navInterna: '.v2-fija-nav', compra: '.v2-fija-compra', whatsapp: '#sably-whatsapp, [data-wa-float]' };
const medirSolapes = (page) => page.evaluate((PIEZAS) => {
  const caja = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'contents' || cs.visibility !== 'visible' || Number(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
    if (r.width < 1 || bottom - top < 1) return null;
    return { el, top, bottom, left: r.left, right: r.right };
  };
  const vistas = Object.entries(PIEZAS).map(([nombre, sel]) => [nombre, caja(document.querySelector(sel))]).filter(([, c]) => c);
  const solapes = [];
  for (let i = 0; i < vistas.length; i++) for (let j = i + 1; j < vistas.length; j++) {
    const [na, a] = vistas[i], [nb, b] = vistas[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue; // la navegación vive dentro de la barra en escritorio
    const alto = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    if (alto > 1 && ancho > 1) solapes.push(`${na} (${Math.round(a.top)}–${Math.round(a.bottom)}) sobre ${nb} (${Math.round(b.top)}–${Math.round(b.bottom)})`);
  }
  return { y: Math.round(scrollY), solapes };
}, PIEZAS);

/** Baja hasta el final y sube por tramos hasta arriba; devuelve cada parada con solape. */
async function recorrerSolapes(page) {
  const fallos = [];
  const alto = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const tramo = Math.max(200, Math.round((await page.evaluate(() => innerHeight)) * 0.6));
  const ir = async (y, sentido) => {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await espera(380); // transiciones de la barra (--t-base) y observadores
    const m = await medirSolapes(page);
    if (m.solapes.length) fallos.push({ sentido, ...m });
  };
  for (let y = 0; y < alto; y += tramo) await ir(y, 'bajando');
  await ir(alto, 'final');
  for (let y = alto - tramo; y > 0; y -= tramo) await ir(y, 'subiendo');
  await ir(0, 'arriba');
  return fallos;
}

const norm = (s) => s.replace(/[^\p{L}\p{N}%.,:;¿?¡!()\-–—/ ]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

for (const ficha of FICHAS) {
  let textoClasico = '';
  let ciudadesClasico = [];
  if (!SOLO_SOLAPES) {
    // Con V2 como tema por defecto, sin ?tema=clasico esto comparaba V2 consigo mismo.
    const clasico = await abrir(`${BASE}/${ficha}/?tema=clasico&verif=${Date.now()}`, TODOS_LOS_ANCHOS[2]);
    textoClasico = await textoMain(clasico);
    ciudadesClasico = await clasico.evaluate(() => [...(document.getElementById('cities-title')?.parentElement?.querySelectorAll('span') ?? [])].map((n) => n.textContent.replace(/📍/g, '').trim()).filter(Boolean));
    await clasico.close();
  }
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
    // Solapes de cabecera, barra de campaña, navegación interna y barra de compra.
    r.solapes = { campanaAbierta: await recorrerSolapes(page) };
    if (await page.evaluate(() => { const b = document.querySelector('[data-promo-v2="barra"]'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; })) {
      await page.evaluate(() => document.querySelector('[data-promo-cerrar]')?.click());
      await espera(300);
      r.solapes.campanaCerrada = await recorrerSolapes(page);
    }
    r.solapes.ok = Object.values(r.solapes).every((f) => !Array.isArray(f) || f.length === 0);
    if (!r.solapes.ok) {
      process.exitCode = 1;
      for (const [estado, fallos] of Object.entries(r.solapes)) if (Array.isArray(fallos)) for (const f of fallos.slice(0, 4)) console.log(`  SOLAPE ${nombre} ${estado} ${f.sentido} y=${f.y}: ${f.solapes.join('; ')}`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await espera(400);
      await page.screenshot({ path: join(SALIDA, `${nombre}-solape.jpg`), type: 'jpeg', quality: 70 });
    }
    if (SOLO_SOLAPES) {
      resultados.push(r);
      console.log(`${nombre}: solapes ${r.solapes.ok ? 'ok' : 'FALLA'}`);
      await page.close();
      continue;
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await espera(400);
    await page.screenshot({ path: join(SALIDA, `${nombre}-pantallazo.jpg`), type: 'jpeg', quality: 70 });
    // La aparición al desplazar (animation-timeline: view()) deja en blanco lo que queda fuera del
    // primer pantallazo en una captura de página entera: se captura con movimiento reducido.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.screenshot({ path: join(SALIDA, `${nombre}-pagina.jpg`), type: 'jpeg', quality: 55, fullPage: true });
    await page.emulateMediaFeatures([]);

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
    // «Disponible online en {país}»: las mismas ciudades que el clásico, en texto y sin enlaces.
    if (ancho.nombre === '1440') {
      const v2 = await page.evaluate(() => {
        const b = document.querySelector('[data-ciudades]');
        return b ? { pais: b.dataset.ciudades, ciudades: [...b.querySelectorAll('li')].map((n) => n.textContent.trim()), enlaces: b.querySelectorAll('a').length, rotulo: b.querySelector('#titulo-ciudades')?.tagName } : null;
      });
      const igual = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
      // Sin producto («cerrado») no hay «Cómo funciona» y tampoco el bloque. Con producto, el bloque
      // debe estar (el ajuste `mostrarCiudades` viene encendido por defecto).
      r.ciudades = v2 ? { ...v2, clasico: ciudadesClasico.length, mismas: igual(v2.ciudades, [...new Set(ciudadesClasico)]) } : { falta: r.estado !== 'cerrado' };
      if (v2 ? (!r.ciudades.mismas || v2.enlaces > 0 || v2.rotulo !== 'P') : r.ciudades.falta) process.exitCode = 1;
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
    console.log(`${nombre}: ${r.preajuste ?? r.estado} botón ${r.botonFinal}px${r.botonSinDesplazar ? ' (sin desplazar)' : ''} solapes ${r.solapes.ok ? 'ok' : 'FALLA'}${r.cupon ? ` cupón ${r.cupon.ok ? 'ok' : 'FALLA'}` : ''}${r.teclado ? ` teclado ${r.teclado.enterQuita ? 'ok' : 'FALLA'}` : ''}${r.barra ? ` barra ${r.barra.visible ? 'ok' : 'FALLA'}` : ''}${r.ciudades?.falta ? ' ciudades FALTAN' : ''}${r.ciudades?.ciudades ? ` ciudades ${r.ciudades.mismas && !r.ciudades.enlaces ? 'ok' : 'FALLA'} (${r.ciudades.ciudades.length} de ${r.ciudades.pais}, clásico ${r.ciudades.clasico})` : ''}${r.desborda ? ' DESBORDA' : ''}`);
    await page.close();
  }
}
writeFileSync(join(SALIDA, `resultados-${entorno}.json`), JSON.stringify({ base: BASE, fecha: new Date().toISOString(), resultados }, null, 1));
const conSolape = resultados.filter((r) => r.solapes && !r.solapes.ok).map((r) => `${r.ficha} a ${r.ancho}`);
console.log(conSolape.length ? `\nSolapes en ${conSolape.length} vistas: ${conSolape.join(', ')}` : `\nSin solapes en ${resultados.length} vistas.`);
await navegador.close();
