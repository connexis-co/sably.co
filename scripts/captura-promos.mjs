#!/usr/bin/env node
/**
 * Captura la galería de temas del banner a PNG.
 *
 * La galería vive en `src/pages/_preview-promos.astro`: el prefijo `_` hace que
 * Astro la excluya del build, así que nunca se publica. Este script la copia sin
 * el prefijo mientras dura la captura y la borra al terminar.
 *
 * Se conecta al Chrome que ya está abierto con --remote-debugging-port=9222,
 * en vez de descargar un Chromium propio.
 *
 * Uso:  node scripts/captura-promos.mjs <urlBase del dev server> [carpetaDestino]
 */

import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FUENTE = 'src/pages/_preview-promos.astro';
const RUTA_TEMPORAL = 'src/pages/preview-promos.astro';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const DESTINO = process.argv[3] ?? 'docs/img/promos';
const URL_GALERIA = `${BASE.replace(/\/$/, '')}/preview-promos/`;

/** Grupos de campañas por captura, para que cada PNG se lea sin hacer zoom. */
const GRUPOS = [
  { archivo: 'banner-50.png', desde: 0, hasta: 4, ancho: 1280, alto: 1800 },
  { archivo: 'banner-25.png', desde: 4, hasta: 9, ancho: 1280, alto: 2200 },
  { archivo: 'banner-ads.png', desde: 9, hasta: 12, ancho: 1280, alto: 1400 },
];

await copyFile(FUENTE, RUTA_TEMPORAL);
// Margen para que el watcher del dev server registre la ruta nueva.
await new Promise((r) => setTimeout(r, 2500));

const browser = await (await import('puppeteer-core')).default.connect({
  browserURL: 'http://127.0.0.1:9222',
  defaultViewport: null,
});

const page = await browser.newPage();
await mkdir(DESTINO, { recursive: true });

async function capturar({ archivo, desde, hasta, ancho, alto }, movil = false) {
  await page.setViewport(
    movil
      ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { width: ancho, height: alto, deviceScaleFactor: 2 },
  );
  await page.goto(URL_GALERIA, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(
    (d, h) => {
      document.querySelectorAll('section').forEach((s, i) => {
        s.style.display = i >= d && i < h ? '' : 'none';
      });
      // La barra del dev toolbar de Astro se cuela en la captura.
      document.querySelector('astro-dev-toolbar')?.remove();
    },
    desde,
    hasta,
  );
  // Dar un frame a que el layout se reasiente tras ocultar secciones.
  await new Promise((r) => setTimeout(r, 400));
  const png = await page.screenshot({ fullPage: true, type: 'png' });
  const salida = path.join(DESTINO, movil ? archivo.replace('.png', '-movil.png') : archivo);
  await writeFile(salida, png);
  console.log(`  ${salida}  ${(png.length / 1024).toFixed(0)} KB`);
}

try {
  for (const g of GRUPOS) await capturar(g, false);
  await capturar({ ...GRUPOS[0], archivo: 'banner-50.png' }, true);
  await capturar({ archivo: 'prueba-social.png', desde: 11, hasta: 13, ancho: 900, alto: 500 }, false);
} finally {
  // Que un fallo a mitad no deje la ruta publicable en el árbol.
  await rm(RUTA_TEMPORAL, { force: true });
  await page.close();
  browser.disconnect();
}
console.log('listo');
