#!/usr/bin/env node
/**
 * Extrae el catálogo completo del club de Seminarios Online: los 1.773 contenidos
 * con su nombre, su módulo y su enlace de afiliación. NO afilia nada.
 *
 * De dónde sale cada dato (rutas verificadas el 2026-08-10):
 *
 * - El árbol completo vive en la caché de React Query de la propia web, bajo la
 *   clave ["navigation","virtualeducation","209718"] (~709 KB). De ahí salen los
 *   20 módulos y, dentro de cada uno, las `pages` con su `name` y su `hash`.
 * - El enlace de afiliación NO está en ese árbol: vive en el campo `content` del
 *   detalle de cada lección, que sirve
 *   `api-club-course-consumption-gateway-ga.cb.hotmart.com/v2/web/lessons/<hash>`
 *   y tiene la forma `app-vlc.hotmart.com/affiliate-recruiting/view/<código>`.
 *
 * El detalle se pide desde el contexto de la página ya autenticada, en tandas, en
 * vez de abrir las 1.773 lecciones una por una.
 *
 * Uso (con el Chrome de --remote-debugging-port=9222 y sesión iniciada):
 *   node scripts/hotmart-catalogo.mjs [--limit N]
 *
 * Salida: docs/data/catalogo-seminarios.json
 * Después: python3 scripts/build-catalogo-xlsx.py
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'docs/data/catalogo-seminarios.json');
const CLUB = 'https://hotmart.com/es/club/virtualeducation/products/209718';
const LECCIONES = 'https://api-club-course-consumption-gateway-ga.cb.hotmart.com/v2/web/lessons';

const args = process.argv.slice(2);
const LIMITE = Number(args[args.indexOf('--limit') + 1]) || Infinity;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let navegador;
  try {
    navegador = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  } catch {
    console.error(
      'No pude conectar con Chrome en :9222. Ábrelo así, con Chrome cerrado del todo:\n' +
        '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n' +
        '    --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-hotmart"\n' +
        'e inicia sesión en https://hotmart.com',
    );
    process.exit(1);
  }

  const page = await navegador.newPage();
  await page.goto(CLUB, { waitUntil: 'networkidle2' });
  await dormir(6000); // la caché de navigation tarda en poblarse

  const arbol = await page.evaluate(() => {
    const qc = window.__SHARED_HOT_CLUB_QUERY_CLIENT__;
    if (!qc) return null;
    const q = qc
      .getQueryCache()
      .getAll()
      .find((x) => JSON.stringify(x.queryKey).includes('"navigation"'));
    const d = q?.state?.data;
    if (!d?.modules) return null;
    const filas = [];
    for (const m of d.modules) {
      for (const p of m.pages ?? []) {
        filas.push({ modulo: m.name, moduloId: m.id, nombre: p.name, hash: p.hash, tipo: p.type });
      }
    }
    return filas;
  });

  if (!arbol) {
    console.error('No encontré el árbol de navegación. ¿La sesión sigue abierta?');
    process.exit(1);
  }
  console.log(`Catálogo: ${arbol.length} contenidos en ${new Set(arbol.map((f) => f.modulo)).size} módulos.`);

  /* El gateway de lecciones exige el token que la web inyecta en sus peticiones.
     Un `fetch` a pelo recibe 401 con WWW-Authenticate y Chrome abre un diálogo de
     usuario/contraseña — que además NO hay que rellenar. Por eso aquí se reutiliza
     el cliente HTTP de la propia app, que ya va autenticado. */
  page.on('dialog', async (d) => {
    await d.dismiss().catch(() => {});
  });
  await page.authenticate(null).catch(() => {});

  const objetivo = arbol.slice(0, LIMITE === Infinity ? arbol.length : LIMITE);
  const salida = [];
  const TANDA = 12;

  for (let i = 0; i < objetivo.length; i += TANDA) {
    const tanda = objetivo.slice(i, i + TANDA);
    const res = await page.evaluate(
      async (hashes, base) => {
        const H = window.__SHARED_HOT_CLUB_HTTP_GLOBAL_HEADERS__ ?? {};
        const inst = window.__SHARED_HOT_CLUB_HTTP_INSTANCES__ ?? {};
        // La instancia del gateway de consumo es la que sirve /v2/web/lessons.
        const cliente = Object.entries(inst).find(([k]) => /CONSUMPTION_GATEWAY/i.test(k))?.[1];

        const sacarLink = (texto) => {
          const m = String(texto).match(
            /app-vlc\.hotmart\.com\\?\/affiliate-recruiting\\?\/view\\?\/[A-Za-z0-9]+/,
          );
          return m ? 'https://' + m[0].replace(/\\/g, '') : null;
        };

        /* El gateway exige `x-product-id` además del Authorization; sin él responde
           400 "Required header 'x-product-id' is not present". 209718 es el id del
           producto del club de Seminarios Online. */
        const extra = { 'x-product-id': '209718' };

        const out = [];
        for (const h of hashes) {
          try {
            if (cliente?.get) {
              const r = await cliente.get(`/v2/web/lessons/${h}`, { headers: extra });
              out.push({ hash: h, ok: true, link: sacarLink(JSON.stringify(r?.data ?? '')) });
            } else {
              const r = await fetch(`${base}/${h}`, {
                credentials: 'include',
                headers: { ...H, ...extra },
              });
              out.push({ hash: h, ok: r.ok, link: r.ok ? sacarLink(await r.text()) : null });
            }
          } catch (e) {
            out.push({ hash: h, ok: false, link: null, err: String(e).slice(0, 80) });
          }
        }
        return out;
      },
      tanda.map((f) => f.hash),
      LECCIONES,
    );

    if (i === 0 && res.every((r) => !r.ok && !r.link)) {
      console.error(
        '\nNinguna lección respondió. Suele ser que la sesión del club no está activa\n' +
          'en ese Chrome: abre https://hotmart.com/es/club/virtualeducation/products/209718,\n' +
          'comprueba que carga el listado, y vuelve a lanzar el script.',
      );
      break;
    }

    for (const r of res) {
      const fila = objetivo.find((f) => f.hash === r.hash);
      salida.push({
        ...fila,
        urlContenido: `${CLUB}/content/${r.hash}`,
        linkAfiliacion: r.link,
        codigoAfiliacion: r.link ? r.link.split('/').pop() : null,
      });
    }
    const conLink = salida.filter((s) => s.linkAfiliacion).length;
    console.log(`  ${salida.length}/${objetivo.length} · con enlace de afiliación: ${conLink}`);
    await dormir(400);
  }

  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 2), 'utf8');
  const conLink = salida.filter((s) => s.linkAfiliacion).length;
  console.log(`\n${conLink}/${salida.length} con enlace de afiliación.`);
  console.log(`Guardado en ${path.relative(RAIZ, SALIDA)}`);
  console.log('Ahora: python3 scripts/build-catalogo-xlsx.py');

  await page.close();
  navegador.disconnect();
}

main();
