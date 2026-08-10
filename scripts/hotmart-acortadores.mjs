#!/usr/bin/env node
/**
 * Crea en Hotmart los dos acortadores de cada curso: `-curso-crashing` (checkout
 * limpio) y `-curso-venta-SO` (página de ventas de Seminarios Online).
 *
 * Por qué un script y no el panel a mano: son ~2 acortadores × 88 cursos, y cada
 * uno son 5 pasos de UI. Aquí el flujo es determinista y deja registro de qué
 * salió y qué no, que es lo que alimenta el XLSX.
 *
 * Se conecta a un Chrome que YA tenga la sesión de Hotmart abierta, para no
 * pedir credenciales ni tocar el login:
 *
 *   1. Cierra Chrome por completo.
 *   2. /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *        --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"
 *   3. Inicia sesión en https://app.hotmart.com
 *   4. node scripts/hotmart-acortadores.mjs [--dry] [--limit N]
 *
 * `--dry` recorre y reporta sin crear nada. Úsalo la primera vez.
 *
 * Flujo por producto (documentado desde el panel real):
 *   Productos → Soy Afiliado(a) → buscar por nombre → "Promocionar producto"
 *   → Links de divulgación (HotLinks) → el bloque "checkout limpio para
 *   crashing" (`?ap=...`) → "Acortar link" → título → slug → Next → End.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = path.join(RAIZ, 'docs/data/acortadores-plan.json');
const SALIDA = path.join(RAIZ, 'docs/data/acortadores-resultado.json');
const ENDPOINT = 'http://127.0.0.1:9222';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMITE = Number(args[args.indexOf('--limit') + 1]) || Infinity;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Texto visible de la página, para buscar rótulos sin depender de clases CSS. */
async function texto(page) {
  return page.evaluate(() => document.body.innerText || '');
}

/** Hace clic en el primer elemento cuyo texto coincide. Devuelve si lo encontró. */
async function clicPorTexto(page, patron, tags = 'button,a') {
  return page.evaluate(
    (p, t) => {
      const re = new RegExp(p, 'i');
      const el = [...document.querySelectorAll(t)].find((e) => re.test((e.textContent || '').trim()));
      if (el) {
        el.click();
        return true;
      }
      return false;
    },
    patron,
    tags,
  );
}

/**
 * Localiza el producto en "Soy Afiliado(a)" y devuelve su id.
 * Devuelve null si no aparece: eso marca la fila en rojo en el XLSX.
 */
async function buscarProducto(page, nombre) {
  await page.goto('https://app.hotmart.com/products/affiliations', { waitUntil: 'networkidle2' });
  await dormir(1200);

  const escrito = await page.evaluate((q) => {
    const inp = document.querySelector('input[type="text"],input[type="search"]');
    if (!inp) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, q);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }));
    return true;
  }, nombre);
  if (!escrito) return null;

  await dormir(2500);
  const t = await texto(page);
  const m = t.match(/ID\s+(\d+)/);
  return m ? m[1] : null;
}

/**
 * Abre los HotLinks del producto y devuelve las URLs `go.hotmart.com` de los dos
 * bloques que nos interesan. Los rótulos son los del panel en español.
 */
async function leerHotlinks(page, idProducto) {
  await page.goto(`https://app.hotmart.com/market/product/${idProducto}`, { waitUntil: 'networkidle2' });
  await dormir(1500);
  await clicPorTexto(page, 'links de divulgaci|divulgaci');
  await dormir(2500);

  return page.evaluate(() => {
    const bloques = [...document.querySelectorAll('div')].filter((d) => {
      const txt = (d.textContent || '').trim();
      return d.querySelector('input') && txt.length < 600;
    });
    const salida = { crashing: null, ventaSO: null, ventas: null };
    for (const b of bloques) {
      const txt = (b.textContent || '').toLowerCase();
      const val = b.querySelector('input')?.value ?? '';
      if (!/go\.hotmart\.com/.test(val)) continue;
      if (/crashing/.test(txt)) salida.crashing ??= val;
      else if (/seminarios online/.test(txt)) salida.ventaSO ??= val;
      else if (/p[áa]gina de ventas/.test(txt)) salida.ventas ??= val;
    }
    return salida;
  });
}

/** Ejecuta el asistente de acortado. Devuelve la URL corta o lanza. */
async function acortar(page, hotlink, titulo, slug) {
  await page.goto('https://app.hotmart.com/tools/shortener/new', { waitUntil: 'networkidle2' }).catch(() => {});
  await dormir(1200);

  // Paso 1: hotlink + título.
  const ok1 = await page.evaluate(
    (h, ti) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const inputs = [...document.querySelectorAll('input[type="text"],input:not([type])')];
      if (inputs.length < 2) return false;
      set.call(inputs[0], h);
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      set.call(inputs[1], ti);
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    hotlink,
    titulo,
  );
  if (!ok1) throw new Error('no encontré los campos del paso 1');
  await clicPorTexto(page, '^next$|siguiente');
  await dormir(2000);

  // Paso 2: el slug del acortador.
  const ok2 = await page.evaluate((s) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const inp = [...document.querySelectorAll('input')].find(
      (i) => /hotm\.io|slug/i.test(i.placeholder || '') || i.closest('div')?.textContent?.includes('hotm.io'),
    );
    if (!inp) return false;
    set.call(inp, s);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, slug);
  if (!ok2) throw new Error('no encontré el campo del slug (paso 2)');
  await clicPorTexto(page, '^next$|siguiente');
  await dormir(2000);

  // Resumen: confirmar.
  await clicPorTexto(page, '^end$|finalizar|concluir');
  await dormir(1500);

  return `https://hotm.io/${slug}`;
}

/** Comprueba que el acortador resuelve a un checkout y conserva la atribución. */
async function verificar(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const destino = r.url;
    return {
      ok: /pay\.hotmart\.com/.test(destino) && /[?&]ref=/.test(destino),
      destino,
      estado: r.status,
    };
  } catch (e) {
    return { ok: false, destino: null, error: String(e).slice(0, 120) };
  }
}

async function main() {
  if (!fs.existsSync(ENTRADA)) {
    console.error(`Falta ${path.relative(RAIZ, ENTRADA)}. Genéralo con scripts/build-acortadores-xlsx.py`);
    process.exit(1);
  }
  const plan = JSON.parse(fs.readFileSync(ENTRADA, 'utf8'));

  let navegador;
  try {
    navegador = await puppeteer.connect({ browserURL: ENDPOINT, defaultViewport: null });
  } catch {
    console.error(
      `No pude conectar con Chrome en ${ENDPOINT}.\n` +
        'Abre Chrome así (con Chrome totalmente cerrado antes):\n' +
        '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n' +
        '    --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"\n' +
        'y luego inicia sesión en https://app.hotmart.com',
    );
    process.exit(1);
  }

  const page = await navegador.newPage();
  const resultados = [];
  let hechos = 0;

  for (const item of plan) {
    if (hechos >= LIMITE) break;
    const fila = { ...item, idProducto: null, crashing: null, ventaSO: null, estado: 'pendiente', nota: '' };

    try {
      const id = await buscarProducto(page, item.nombreProducto);
      if (!id) {
        fila.estado = 'SIN_PRODUCTO';
        fila.nota = 'No aparece en Soy Afiliado(a). Requiere buscar alternativa en el mercado.';
        resultados.push(fila);
        console.log(`✗ ${item.slugSably}: sin producto afiliado`);
        continue;
      }
      fila.idProducto = id;

      const links = await leerHotlinks(page, id);
      if (!links.crashing) {
        fila.estado = 'SIN_HOTLINK';
        fila.nota = 'El producto no expone el hotlink de checkout limpio (crashing).';
        resultados.push(fila);
        console.log(`✗ ${item.slugSably}: sin hotlink crashing`);
        continue;
      }

      if (DRY) {
        fila.estado = 'DRY';
        fila.nota = `crashing=${links.crashing} ventaSO=${links.ventaSO ?? '-'}`;
        resultados.push(fila);
        console.log(`· ${item.slugSably}: ${links.crashing}`);
        hechos++;
        continue;
      }

      fila.crashing = await acortar(page, links.crashing, `${item.titulo} crashing`, item.slugCrashing);
      const v1 = await verificar(fila.crashing);
      if (!v1.ok) {
        fila.estado = 'CREADO_SIN_VERIFICAR';
        fila.nota = `El acortador no resolvió a un checkout con ref: ${v1.destino ?? v1.error}`;
      } else {
        fila.estado = 'OK';
        fila.nota = v1.destino;
      }

      if (links.ventaSO) {
        try {
          fila.ventaSO = await acortar(page, links.ventaSO, `${item.titulo} venta SO`, item.slugVentaSO);
        } catch (e) {
          fila.nota += ` · venta-SO falló: ${String(e).slice(0, 80)}`;
        }
      }

      hechos++;
      console.log(`✓ ${item.slugSably}: ${fila.crashing}`);
    } catch (e) {
      fila.estado = 'ERROR';
      fila.nota = String(e).slice(0, 200);
      console.log(`✗ ${item.slugSably}: ${fila.nota}`);
    }
    resultados.push(fila);
    await dormir(800);
  }

  fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 2), 'utf8');
  const ok = resultados.filter((r) => r.estado === 'OK').length;
  console.log(`\n${ok}/${resultados.length} creados y verificados.`);
  console.log(`Resultado en ${path.relative(RAIZ, SALIDA)} (alimenta el XLSX con los rojos).`);
  await page.close();
  navegador.disconnect();
}

main();
