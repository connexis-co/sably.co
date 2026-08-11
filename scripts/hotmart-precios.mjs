#!/usr/bin/env node
/**
 * Captura los precios y valoraciones REALES de Hotmart para todo el catálogo.
 *
 * Sin navegador: el checkout es Nuxt con SSR y el precio viaja embebido en el
 * HTML inicial (localizado por IP + base USD). La valoración sale de la página
 * pública del producto (hotlink con ?dp=1), que trae `"rating"` y
 * `"totalReviews"` — los de verdad, dejados por compradores.
 *
 * Salida: src/data/hotmart-live.json, que el build hornea en las 5.955 páginas.
 *
 * Uso:
 *   node scripts/hotmart-precios.mjs                captura todo y escribe el JSON
 *   node scripts/hotmart-precios.mjs --merge-api    antes de capturar, funde lo
 *                                                   que D1 tenga más fresco
 *                                                   (monedas de otros países)
 *   node scripts/hotmart-precios.mjs --post         además, sube lo capturado a
 *                                                   D1 (SNAPSHOT_TOKEN en env)
 *   node scripts/hotmart-precios.mjs --solo <slug>  un curso, para depurar
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no .pathname: la ruta del proyecto lleva espacios y el
// pathname crudo los deja como %20, que scandir no encuentra.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURSOS = path.join(RAIZ, 'src/content/courses');
const SALIDA = path.join(RAIZ, 'src/data/hotmart-live.json');
const API = process.env.SABLY_API ?? 'https://sably.co';

const args = process.argv.slice(2);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

/** Cursos publicados con URL de Hotmart (acortador o go.hotmart). */
function catalogo() {
  const out = [];
  for (const f of readdirSync(CURSOS).filter((x) => x.endsWith('.mdx'))) {
    const slug = f.replace(/\.mdx$/, '');
    if (args.includes('--solo') && args[args.indexOf('--solo') + 1] !== slug) continue;
    const crudo = readFileSync(path.join(CURSOS, f), 'utf8');
    const m = crudo.match(/^hotmartUrl:\s*(\S+)/m);
    const titulo = crudo.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? slug;
    if (m && !m[1].includes('PENDIENTE')) out.push({ slug, url: m[1], titulo });
  }
  return out;
}

/** Sigue las redirecciones del acortador hasta el checkout real. */
async function resolver(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  const html = await r.text();
  return { final: r.url, html };
}

/**
 * Pares `numero,"XXX"` del payload devalue del checkout: primer valor por
 * moneda. Verificado: C55918118T da [165450 COP, 49.99 USD].
 */
function extraerPrecios(html) {
  const vistos = new Map();
  for (const m of html.matchAll(/(\d{1,9}(?:\.\d{1,2})?),"([A-Z]{3})"/g)) {
    const monto = Number(m[1]);
    if (!vistos.has(m[2]) && monto > 0) vistos.set(m[2], monto);
  }
  return vistos;
}

async function main() {
  const cursos = catalogo();
  console.log(`${cursos.length} cursos con producto`);

  const datos = existsSync(SALIDA)
    ? JSON.parse(readFileSync(SALIDA, 'utf8'))
    : { _fuente: '', precios: {}, valoraciones: {}, resenas: {}, productos: {} };

  // Lo fresco de D1 primero (monedas capturadas por visitantes de otros países)
  if (args.includes('--merge-api')) {
    try {
      const d = await (await fetch(`${API}/api/v1/precios`, { signal: AbortSignal.timeout(15000) })).json();
      for (const [slug, monedas] of Object.entries(d.precios ?? {})) {
        datos.precios[slug] = { ...datos.precios[slug], ...monedas };
      }
      for (const [slug, v] of Object.entries(d.valoraciones ?? {})) datos.valoraciones[slug] = v;
      console.log('fundido con D1');
    } catch (e) {
      console.log(`sin D1 (${e.message}): sigo con lo local`);
    }
  }

  let ok = 0;
  const fallos = [];
  for (const { slug, url, titulo } of cursos) {
    try {
      const { final, html } = await resolver(url);
      const pay = final.match(/pay\.hotmart\.com\/[A-Z0-9]+/i)?.[0];
      const hotlink = final.match(/[?&]ref=([A-Z0-9]+)/i)?.[1] ?? '';
      const precios = extraerPrecios(html);
      if (!precios.size) throw new Error('checkout sin precios en el payload');

      datos.precios[slug] = { ...datos.precios[slug], ...Object.fromEntries(precios) };
      if (pay) datos.productos[slug] = { payUrl: `https://${pay}`, hotlink, titulo };

      // Valoración y reseñas públicas del producto. La página del marketplace
      // (hotlink con ?dp=1) da el idProducto; con él, la API pública de
      // valoraciones (api-ask.hotmart.com) devuelve la media, el total y las
      // últimas reseñas CON el nombre que su autor publicó en Hotmart.
      if (hotlink) {
        try {
          const { html: hp } = await resolver(`https://go.hotmart.com/${hotlink}?dp=1`);
          const idProducto = hp.match(/"productId":(\d{5,9})/)?.[1];
          if (idProducto) {
            const r = await fetch(
              `https://api-ask.hotmart.com/api/v1/survey/product/${idProducto}/rating`,
              { headers: UA, signal: AbortSignal.timeout(20000) },
            );
            if (r.ok) {
              const d = await r.json();
              const rating = Number(d.average);
              const total = Number(d.totalAnswers);
              if (rating >= 1 && rating <= 5 && total > 0) {
                datos.valoraciones[slug] = { rating: Math.round(rating * 100) / 100, total };
              }
              // Reseñas con nombre: solo las que traen autor y nota. El texto
              // se recorta a una frase; es un aviso, no una página de reseñas.
              const resenas = (d.latestAnswers ?? [])
                .map((a) => {
                  const nota = Number(a.answers?.find((x) => x.type === 'RATING_1_5')?.answer);
                  const texto = a.answers?.find((x) => x.type !== 'RATING_1_5' && x.answer?.length > 3)?.answer ?? '';
                  return {
                    nombre: String(a.userName ?? '').trim(),
                    rating: nota,
                    ...(texto ? { texto: texto.replace(/\s+/g, ' ').slice(0, 120) } : {}),
                  };
                })
                .filter(
                  (x) =>
                    x.nombre &&
                    x.nombre.length >= 2 &&
                    x.nombre.length <= 30 &&
                    x.rating >= 4 &&
                    // Nombres de relleno que no son personas.
                    !/^(curso|cursos|an[oó]nim[oa]|usuario|user|test|hotmart)$/i.test(x.nombre),
                )
                .slice(0, 5);
              if (resenas.length) datos.resenas[slug] = resenas;
              if (datos.productos[slug]) datos.productos[slug].idProducto = Number(idProducto);
            }
          }
        } catch {
          /* sin valoración no pasa nada: la ficha simplemente no pinta estrellas */
        }
      }

      ok++;
      const p = [...precios].map(([m, v]) => `${v} ${m}`).join(' · ');
      const val = datos.valoraciones[slug];
      console.log(`  ${slug.padEnd(46)} ${p}${val ? `  ★${val.rating} (${val.total})` : ''}`);
      await dormir(400);
    } catch (e) {
      fallos.push(`${slug}: ${e.message}`);
      console.log(`  ${slug.padEnd(46)} FALLO ${e.message.slice(0, 60)}`);
    }
  }

  datos._fuente =
    'Precios del checkout real de Hotmart (payload SSR) y valoraciones públicas del marketplace. ' +
    'Nada de este fichero es inventado; si un curso no aparece, no se muestra el dato.';
  datos._capturado = new Date().toISOString();
  writeFileSync(SALIDA, JSON.stringify(datos, null, 1) + '\n');
  console.log(`\n${ok}/${cursos.length} capturados → ${path.relative(RAIZ, SALIDA)}`);
  if (fallos.length) console.log(`fallos:\n  ${fallos.join('\n  ')}`);

  if (args.includes('--post')) {
    const token = process.env.SNAPSHOT_TOKEN;
    if (!token) {
      console.log('sin SNAPSHOT_TOKEN: no subo a D1');
      return;
    }
    const cuerpo = {
      productos: Object.entries(datos.productos).map(([slug, p]) => ({ slug, ...p })),
      precios: Object.entries(datos.precios).flatMap(([slug, ms]) =>
        Object.entries(ms).map(([moneda, monto]) => ({ slug, moneda, monto })),
      ),
      valoraciones: Object.entries(datos.valoraciones).map(([slug, v]) => ({ slug, ...v })),
    };
    const r = await fetch(`${API}/api/v1/precios`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    console.log(`POST a D1: ${r.status} ${await r.text()}`);
  }
}

main();
