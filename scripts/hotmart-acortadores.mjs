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

/** Club de Seminarios Online: es el catálogo donde vive el link de afiliación. */
const CLUB = 'https://hotmart.com/es/club/virtualeducation/products/209718';

/**
 * Afilia la cuenta al producto, que es el paso previo a todo lo demás: sin
 * afiliación aprobada no existe hotlink y por tanto no hay nada que acortar.
 *
 * El camino es el del club, no el del mercado: el mercado busca por texto libre
 * sobre todo Hotmart y devuelve productos de otros productores con nombres
 * parecidos. Dentro del club cada curso trae su propio enlace
 * "CLICK AQUÍ PARA AFILIARTE AL PRODUCTO", que apunta al producto correcto.
 *
 * Devuelve 'ya' | 'afiliado' | 'no-encontrado' | 'sin-enlace'.
 */
async function afiliar(page, nombreCurso) {
  await page.goto(CLUB, { waitUntil: 'networkidle2' });
  await dormir(2000);

  // Buscador del club.
  const buscó = await page.evaluate((q) => {
    const inp = [...document.querySelectorAll('input')].find((i) =>
      /buscar/i.test(`${i.placeholder} ${i.getAttribute('aria-label') ?? ''}`),
    );
    if (!inp) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, q);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }));
    return true;
  }, nombreCurso);
  if (!buscó) return 'no-encontrado';
  await dormir(2500);

  // Primer resultado cuyo título coincide de verdad, no el primero a secas:
  // "Aprende Piano" y "Piano para Niños" son productos distintos.
  const abrió = await page.evaluate((q) => {
    const norm = (s) =>
      s
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const objetivo = norm(q);
    const cand = [...document.querySelectorAll('a,div,li')].filter((e) =>
      norm(e.textContent || '').includes(objetivo),
    );
    const el = cand.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (!el) return false;
    (el.closest('a') ?? el).click();
    return true;
  }, nombreCurso);
  if (!abrió) return 'no-encontrado';
  await dormir(3000);

  // El enlace de afiliación vive en la pestaña "Descripción" del contenido.
  const url = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) =>
      /afiliarte al producto|afiliarte/i.test(x.textContent || ''),
    );
    return a?.href ?? null;
  });
  if (!url) return 'sin-enlace';

  await page.goto(url, { waitUntil: 'networkidle2' });
  await dormir(2500);

  const t = await texto(page);
  if (/ya eres afiliado/i.test(t)) return 'ya';

  await clicPorTexto(page, 'ingresa para afiliarte|afiliarme|afiliarte ahora');
  await dormir(3000);
  return /ya eres afiliado/i.test(await texto(page)) ? 'afiliado' : 'sin-enlace';
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
 * Lee los HotLinks del producto.
 *
 * La página es `app.hotmart.com/hotlinks/<idProducto>` y lista siempre cuatro
 * enlaces del mismo hotlink, en este orden (verificado el 2026-08-10 con el
 * producto 1259120, "Sushi en Casa"):
 *
 *   1. Página de Ventas            → go.hotmart.com/<H>          → universidad.online/...
 *   2. Página de Producto          → go.hotmart.com/<H>?dp=1
 *   3. checkout limpio "crashing"  → go.hotmart.com/<H>?ap=XXXX  → pay.hotmart.com/<P>?ref=<H>
 *   4. checkout de Seminarios      → go.hotmart.com/<H>?ap=YYYY  → ...&checkoutMode=10
 *
 * El sufijo `ap` cambia por producto, así que se identifican por su rótulo y se
 * usa el orden solo como respaldo.
 */
async function leerHotlinks(page, idProducto) {
  await page.goto(`https://app.hotmart.com/hotlinks/${idProducto}`, { waitUntil: 'networkidle2' });
  await dormir(2000);

  return page.evaluate(() => {
    const urls = [...document.querySelectorAll('input')]
      .map((i) => i.value)
      .filter((v) => /go\.hotmart\.com/.test(v));
    const lineas = (document.body.innerText || '').split('\n').map((s) => s.trim());
    const iCrash = lineas.findIndex((l) => /checkout limpio para crashing/i.test(l));
    const iSO = lineas.findIndex((l) => /checkout creado por seminarios/i.test(l));

    // Con rótulos presentes el orden de los inputs coincide con el de los bloques.
    const porOrden = { crashing: urls[2] ?? null, ventaSO: urls[3] ?? null };
    return {
      crashing: iCrash >= 0 ? porOrden.crashing : (urls.find((u) => /\?ap=/.test(u)) ?? null),
      ventaSO: iSO >= 0 ? porOrden.ventaSO : (urls.filter((u) => /\?ap=/.test(u))[1] ?? null),
      todos: urls,
    };
  });
}

/**
 * Ejecuta el asistente de acortado y devuelve la URL corta.
 *
 * Se entra directo por `shortener/form?link=<hotlink>`, que deja el paso 1 con el
 * enlace ya puesto; así no hay que navegar el panel hasta el botón "Acortar link".
 * El paso 2 llega con un slug aleatorio que hay que sustituir por el nuestro.
 */
async function acortar(page, hotlink, titulo, slug) {
  const url = `https://app.hotmart.com/shortener/form?link=${encodeURIComponent(hotlink)}`;
  await page.goto(url, { waitUntil: 'networkidle2' });
  await dormir(1800);

  // Paso 1: el enlace ya viene del query param; solo falta el título, que es el
  // campo con placeholder "Title of shortened link".
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
  if (!ok1) throw new Error('no encontré el campo de título (paso 1)');
  await clicPorTexto(page, '^next$|siguiente');
  await dormir(2500);

  // Paso 2: Hotmart precarga un slug aleatorio (p. ej. "G6mfpUf"); se sustituye
  // por el de la convención. Es el input que vive junto al prefijo "hotm.io/".
  const ok2 = await page.evaluate((s) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const inp = [...document.querySelectorAll('input')].find((i) => {
      const cerca = i.parentElement?.textContent ?? '';
      return /hotm\.io/.test(cerca) || /hotm\.io/.test(i.previousElementSibling?.textContent ?? '');
    });
    if (!inp) return false;
    inp.focus();
    set.call(inp, '');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    set.call(inp, s);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return inp.value === s;
  }, slug);
  if (!ok2) throw new Error('no pude fijar el slug (paso 2)');
  await clicPorTexto(page, '^next$|siguiente');
  await dormir(2500);

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
      // Paso 0: afiliarse. Sin esto no hay hotlink y no habría nada que acortar.
      const af = await afiliar(page, item.nombreProducto);
      fila.afiliacion = af;
      if (af === 'no-encontrado' || af === 'sin-enlace') {
        fila.estado = 'SIN_PRODUCTO';
        fila.nota =
          af === 'no-encontrado'
            ? 'No aparece en el club de Seminarios Online: buscar sustituto en el mercado con comisión > 20%.'
            : 'Aparece en el club pero sin enlace de afiliación utilizable.';
        resultados.push(fila);
        console.log(`✗ ${item.slugSably}: ${fila.nota}`);
        continue;
      }
      console.log(`  ${item.slugSably}: afiliación ${af}`);

      const id = await buscarProducto(page, item.nombreProducto);
      if (!id) {
        fila.estado = 'SIN_PRODUCTO';
        fila.nota = 'Afiliado pero no aparece en Soy Afiliado(a); puede estar pendiente de aprobación.';
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
