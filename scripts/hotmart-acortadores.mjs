#!/usr/bin/env node
/**
 * Afilia y crea los dos acortadores de cada curso de sably que tiene producto en
 * el club de Seminarios Online.
 *
 * Flujo por curso (verificado a mano el 2026-08-10 con Sushi en Casa e Inglés
 * para Principiantes):
 *
 *   1. app-vlc.hotmart.com/affiliate-recruiting/view/<codigo>
 *      El código sale de docs/data/afiliacion-seminarios.tsv. Si ya estás
 *      afiliado la página lo dice y se salta el paso.
 *   2. Botón "Afiliarse Ahora" → Hotmart redirige a app.hotmart.com/hotlinks/<idProducto>.
 *      Ahí están los cuatro enlaces del hotlink, siempre en este orden:
 *        1.º Página de Ventas   → universidad.online/... (no sirve)
 *        2.º Página de Producto → marketplace ?dp=1
 *        3.º checkout limpio "crashing" → pay.hotmart.com/<P>?ref=<H>
 *        4.º checkout de Seminarios     → ...?checkoutMode=10&ref=<H>
 *      El sufijo `ap` cambia por producto, así que se localizan por rótulo y el
 *      orden queda como respaldo.
 *   3. app.hotmart.com/shortener/form?link=<hotlink> abre el asistente con el
 *      enlace ya puesto: título → Next → slug → Next → End.
 *   4. Se comprueba que el acortador resuelve a un checkout y conserva `ref`.
 *
 * Uso (Chrome con depuración remota y sesión de Hotmart abierta):
 *   1. Cierra Chrome del todo.
 *   2. /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *        --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"
 *   3. Inicia sesión en https://app.hotmart.com
 *   4. node scripts/hotmart-acortadores.mjs [--dry] [--limit N]
 *
 * `--dry` recorre y reporta sin afiliar ni crear nada. Úsalo la primera vez.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSV = path.join(RAIZ, 'docs/data/afiliacion-seminarios.tsv');
const CURSOS = path.join(RAIZ, 'src/content/courses');
const SALIDA = path.join(RAIZ, 'docs/data/acortadores-resultado.json');

const RECLUTA = 'https://app-vlc.hotmart.com/affiliate-recruiting/view';
const SHORTENER = 'https://app.hotmart.com/shortener/form';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMITE = Number(args[args.indexOf('--limit') + 1]) || Infinity;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const texto = (page) => page.evaluate(() => document.body.innerText || '');

async function clicPorTexto(page, patron) {
  return page.evaluate((p) => {
    const re = new RegExp(p, 'i');
    const el = [...document.querySelectorAll('button,a')].find((e) => re.test((e.textContent || '').trim()));
    if (!el) return false;
    el.click();
    return true;
  }, patron);
}

/** Lee el archiveSlug de cada curso: es la base del slug del acortador. */
function archiveSlugs() {
  const seleccion = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/data/seleccion-cursos.json'), 'utf8'));
  return Object.fromEntries(seleccion.map((c) => [c.sablySlug, c.archiveSlug]));
}

function plan() {
  const slugs = archiveSlugs();
  const filas = [];
  for (const linea of fs.readFileSync(TSV, 'utf8').split('\n')) {
    if (!linea.trim() || linea.startsWith('#')) continue;
    const [slugSably, codigo, nota] = linea.split('\t');
    if (!codigo) continue; // ambiguos y no-existentes se resuelven a mano
    const archive = slugs[slugSably] ?? slugSably.replace(/^curso-de-/, '');
    filas.push({
      slugSably,
      codigo,
      producto: nota ?? '',
      slugCrashing: `${archive}-curso-crashing`,
      slugVentaSO: `${archive}-curso-venta-SO`,
    });
  }
  return filas;
}

/**
 * Busca el id interno del producto en "Soy Afiliado(a)".
 *
 * Hace falta para los productos que YA estaban afiliados: la página de
 * reclutamiento se limita a decir «Ya eres Afiliado(a)» y no ofrece ningún
 * enlace a sus hotlinks, así que el id hay que sacarlo del listado.
 *
 * `nombreClub` es la tercera columna del TSV, tal cual aparece en el club.
 */
async function idPorNombre(page, nombreClub) {
  const limpio = nombreClub.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/, '').trim();
  if (!limpio) return null;

  await page.goto('https://app.hotmart.com/products/affiliations', { waitUntil: 'networkidle2' });
  await dormir(2000);

  await page.evaluate((q) => {
    const inp = document.querySelector('input[type="text"],input[type="search"]');
    if (!inp) return;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    inp.focus();
    set.call(inp, q);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }));
  }, limpio);
  await dormir(3000);

  return page.evaluate(() => {
    const m = (document.body.innerText || '').match(/ID\s+(\d+)/);
    return m ? m[1] : null;
  });
}

/** Afilia si hace falta. Devuelve el id de producto o null. */
async function afiliar(page, codigo, nombreClub) {
  await page.goto(`${RECLUTA}/${codigo}`, { waitUntil: 'networkidle2' });
  await dormir(2500);

  if (/ya eres afiliado/i.test(await texto(page))) {
    // Ya afiliado: el id solo se puede recuperar desde el listado.
    return idPorNombre(page, nombreClub);
  }

  if (!(await clicPorTexto(page, 'afiliarse ahora|ingresa para afiliarte'))) return null;
  // La afiliación navega a /hotlinks/<id>; no es XHR, así que se espera la URL.
  for (let i = 0; i < 20 && !/\/hotlinks\/\d+/.test(page.url()); i++) await dormir(1000);

  const m = page.url().match(/\/hotlinks\/(\d+)/);
  return m ? m[1] : idPorNombre(page, nombreClub);
}

/** Devuelve {crashing, ventaSO} leyendo la página de hotlinks. */
async function leerHotlinks(page, idProducto) {
  if (!/\/hotlinks\//.test(page.url())) {
    await page.goto(`https://app.hotmart.com/hotlinks/${idProducto}`, { waitUntil: 'networkidle2' });
  }
  await dormir(2500);
  return page.evaluate(() => {
    const urls = [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => /go\.hotmart\.com/.test(v));
    const conAp = urls.filter((u) => /\?ap=/.test(u));
    return { crashing: conAp[0] ?? null, ventaSO: conAp[1] ?? null, todos: urls };
  });
}

/** Ejecuta el asistente de acortado. Devuelve la URL corta. */
async function acortar(page, hotlink, titulo, slug) {
  await page.goto(`${SHORTENER}?link=${encodeURIComponent(hotlink)}`, { waitUntil: 'networkidle2' });
  await dormir(2000);

  const ok1 = await page.evaluate((ti) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const inp = [...document.querySelectorAll('input')].find((i) => /title/i.test(i.placeholder || ''));
    if (!inp) return false;
    inp.focus();
    set.call(inp, ti);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, titulo);
  if (!ok1) throw new Error('paso 1: no encontré el campo de título');
  await clicPorTexto(page, '^next$|siguiente');
  await dormir(2500);

  // Hotmart precarga un slug aleatorio; se sustituye por el de la convención.
  const ok2 = await page.evaluate((s) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const inp = [...document.querySelectorAll('input')].find((i) =>
      /hotm\.io/.test(i.parentElement?.textContent ?? ''),
    );
    if (!inp) return false;
    inp.focus();
    set.call(inp, s);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return inp.value === s;
  }, slug);
  if (!ok2) throw new Error('paso 2: no pude fijar el slug');
  await clicPorTexto(page, '^next$|siguiente');
  await dormir(2500);

  await clicPorTexto(page, '^end$|finalizar|concluir');
  await dormir(2000);
  return `https://hotm.io/${slug}`;
}

/** El acortador debe resolver a un checkout conservando la atribución. */
async function verificar(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    return { ok: /pay\.hotmart\.com/.test(r.url) && /[?&]ref=/.test(r.url), destino: r.url };
  } catch (e) {
    return { ok: false, destino: null, error: String(e).slice(0, 120) };
  }
}

async function main() {
  let navegador;
  try {
    navegador = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  } catch {
    console.error(
      'No pude conectar con Chrome en :9222. Ábrelo así, con Chrome cerrado del todo:\n' +
        '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n' +
        '    --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"\n' +
        'e inicia sesión en https://app.hotmart.com',
    );
    process.exit(1);
  }

  const page = await navegador.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  const filas = plan().slice(0, LIMITE === Infinity ? undefined : LIMITE);
  console.log(`${filas.length} cursos con código de afiliación.${DRY ? ' (dry-run)' : ''}\n`);

  const resultados = [];
  for (const item of filas) {
    const fila = { ...item, idProducto: null, crashing: null, ventaSO: null, estado: '', nota: '' };
    try {
      const id = await afiliar(page, item.codigo, item.producto);
      if (!id) throw new Error('no localicé el id del producto (¿ya afiliado y no aparece en Soy Afiliado?)');
      fila.idProducto = id;

      const links = await leerHotlinks(page, id);
      if (!links.crashing) throw new Error('el producto no expone hotlink de checkout limpio');

      if (DRY) {
        fila.estado = 'DRY';
        fila.nota = `crashing=${links.crashing} ventaSO=${links.ventaSO ?? '-'}`;
        console.log(`· ${item.slugSably}: producto ${id} — ${links.crashing}`);
        resultados.push(fila);
        continue;
      }

      fila.crashing = await acortar(page, links.crashing, `${item.slugSably} crashing`, item.slugCrashing);
      const v = await verificar(fila.crashing);
      fila.estado = v.ok ? 'OK' : 'CREADO_SIN_VERIFICAR';
      fila.nota = v.destino ?? v.error ?? '';

      if (links.ventaSO) {
        try {
          fila.ventaSO = await acortar(page, links.ventaSO, `${item.slugSably} venta SO`, item.slugVentaSO);
        } catch (e) {
          fila.nota += ` · venta-SO falló: ${String(e).slice(0, 90)}`;
        }
      }
      console.log(`${v.ok ? '✓' : '⚠'} ${item.slugSably}: ${fila.crashing}`);
    } catch (e) {
      fila.estado = 'ERROR';
      fila.nota = String(e.message ?? e).slice(0, 200);
      console.log(`✗ ${item.slugSably}: ${fila.nota}`);
    }
    resultados.push(fila);
    fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 2), 'utf8'); // por si se corta
    await dormir(800);
  }

  const ok = resultados.filter((r) => r.estado === 'OK').length;
  console.log(`\n${ok}/${resultados.length} creados y verificados.`);
  console.log(`Resultado en ${path.relative(RAIZ, SALIDA)}`);
  console.log('Después: python3 scripts/aplicar-acortadores.py para volcarlo al catálogo.');
  await page.close();
  navegador.disconnect();
}

main();
