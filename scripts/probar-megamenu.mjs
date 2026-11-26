#!/usr/bin/env node
/**
 * Prueba el megamenú «Cursos» de la cabecera V2 en portada, listado, ficha y blog, a 1024, 1280, 1440 y 1920.
 *
 *   node scripts/probar-megamenu.mjs --base http://127.0.0.1:4393
 *   node scripts/probar-megamenu.mjs --base https://sably.co --anchos 1440
 *
 * Por cada página y ancho, arriba del todo y tras bajar 1.200 px, comprueba que:
 *   - el velo cubre la ventana entera bajo la cabecera (rectángulo del velo frente a la ventana);
 *   - el panel cabe en la ventana (ni se sale por los lados ni por abajo);
 *   - con el menú abierto la rueda no desplaza el fondo y el ancho de la página no cambia;
 *   - la fila de la cabecera no se sale por la derecha;
 *   - se cierra con Escape y con un clic fuera (abierto con el botón de la flecha).
 * Sale con código 1 si algo falla. Usa un agente de Chrome normal: nginx de producción responde 403 a HeadlessChrome.
 */
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = opcion('base', 'http://127.0.0.1:4321').replace(/\/$/, '');
const ANCHOS = opcion('anchos', '1024,1280,1440,1920').split(',').map(Number);
const ALTO = Number(opcion('alto', '800'));
const RUTAS = opcion('rutas', '/co/,/co/cursos/,/co/curso-de-masajes-terapeuticos-y-relajantes/,/blog/').split(',');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const espera = ms => new Promise(r => setTimeout(r, ms));

const navegador = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const fallos = [];
const pagina = await navegador.newPage();
await pagina.setUserAgent(UA);

const medir = () => pagina.evaluate(() => {
  const r = e => { const x = e.getBoundingClientRect(); return { x: x.left, y: x.top, w: x.width, h: x.height, abajo: x.bottom, der: x.right }; };
  const velo = document.querySelector('[data-mega-velo]');
  const panel = document.querySelector('.v2-mega-panel');
  const cab = document.querySelector('[data-cabecera]');
  const c = velo && getComputedStyle(velo);
  return {
    vw: document.documentElement.clientWidth, vh: innerHeight,
    velo: velo && r(velo), veloVisible: !!c && c.visibility === 'visible' && Number(c.opacity) > 0.9,
    panel: panel && r(panel), cabAbajo: cab ? cab.getBoundingClientRect().bottom : 0,
    anchoCuerpo: document.body.getBoundingClientRect().width, y: scrollY,
    cabDerecha: Math.max(...[...document.querySelectorAll('.v2-cabecera-fila *')].filter(e => e.getClientRects().length && !e.closest('.v2-mega')).map(e => e.getBoundingClientRect().right)),
  };
});

for (const ancho of ANCHOS) {
  await pagina.setViewport({ width: ancho, height: ALTO });
  for (const ruta of RUTAS) {
    for (const bajada of [0, 1200]) {
      const id = `${ruta} @${ancho}${bajada ? ' (bajada)' : ''}`;
      const mal = m => fallos.push(`${id}: ${m}`);
      await pagina.goto(`${BASE}${ruta}?mm=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 90_000 });
      await pagina.evaluate(y => window.scrollTo(0, y), bajada);
      await espera(500);
      const antes = await medir();
      if (antes.cabDerecha > antes.vw) mal(`la cabecera se sale por la derecha (${Math.round(antes.cabDerecha)} de ${antes.vw})`);
      await pagina.hover('[data-mega-gatillo]');
      await espera(700);
      const m = await medir();
      if (!m.velo || !m.veloVisible) { mal('el velo no se ve'); continue; }
      if (Math.abs(m.velo.x) > 1 || Math.abs(m.velo.w - m.vw) > 1) mal(`el velo no cubre el ancho (${Math.round(m.velo.x)}, ${Math.round(m.velo.w)} de ${m.vw})`);
      if (Math.abs(m.velo.y - m.cabAbajo) > 2) mal(`el velo no empieza bajo la cabecera (${Math.round(m.velo.y)} frente a ${Math.round(m.cabAbajo)})`);
      if (m.velo.abajo < m.vh - 1) mal(`el velo no llega al pie de la ventana (${Math.round(m.velo.abajo)} de ${m.vh})`);
      if (m.panel.x < 0 || m.panel.der > m.vw || m.panel.abajo > m.vh) mal(`el panel se sale de la ventana (${JSON.stringify(m.panel)})`);
      if (m.anchoCuerpo !== antes.anchoCuerpo) mal(`el ancho de la página cambia al abrir (${antes.anchoCuerpo} → ${m.anchoCuerpo})`);
      await pagina.mouse.wheel({ deltaY: 400 });
      await espera(300);
      if ((await medir()).y !== m.y) mal('la rueda desplaza el fondo con el menú abierto');
      // Fuera del menú: se cierra y el fondo vuelve a desplazarse.
      await pagina.mouse.move(Math.round(m.vw / 2), m.vh - 5);
      await espera(500);
      if ((await medir()).veloVisible) mal('el velo sigue al sacar el ratón');
      // Con el botón (teclado o clic): Escape y clic fuera.
      await pagina.click('[data-mega-boton]');
      await espera(500);
      if (!(await medir()).veloVisible) { mal('el botón no abre'); continue; }
      await pagina.keyboard.press('Escape');
      await espera(500);
      if ((await medir()).veloVisible) mal('Escape no cierra');
      await pagina.mouse.move(5, 5);
      await pagina.click('[data-mega-boton]');
      await espera(400);
      await pagina.mouse.click(Math.round(m.vw / 2), m.vh - 10);
      await espera(500);
      if ((await medir()).veloVisible) mal('el clic fuera no cierra');
      if (await pagina.evaluate(() => document.documentElement.hasAttribute('data-mega-abierto'))) mal('el fondo queda bloqueado tras cerrar');
    }
  }
}
await navegador.close();
console.log(`Megamenú: ${ANCHOS.length * RUTAS.length * 2} vistas, ${fallos.length} fallos`);
for (const f of fallos) console.log(`  ✗ ${f}`);
process.exit(fallos.length ? 1 : 0);
