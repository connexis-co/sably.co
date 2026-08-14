#!/usr/bin/env node
/**
 * Auditoría empírica: ¿a qué cursos les aplica DE VERDAD el cupón del sitio?
 *
 * El cupón (031016, −50 %) pertenece a un productor concreto. Hotmart solo lo
 * aplica en los checkouts de SUS productos; en los de otros productores el
 * parámetro viaja igual pero no descuenta nada. Publicar «−50 %» en una ficha
 * cuyo checkout cobra el precio entero es discrepancia entre anuncio y destino.
 *
 * Método: para cada curso con producto se visita el checkout dos veces por el
 * MISMO camino que un visitante (el acortador del frontmatter, siguiendo sus
 * redirecciones), sin cupón y con `?offDiscount=031016`, y se comparan los
 * precios que el checkout incrusta en su HTML. No se deduce nada del nombre
 * del producto ni del acortador: se mide el comportamiento.
 *
 * Salida: docs/data/auditoria-cupon-031016.json + resumen en consola.
 * Uso:  node scripts/auditar-cupon.mjs [--solo <slug>]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURSOS = path.join(RAIZ, 'src/content/courses');
const SALIDA = path.join(RAIZ, 'docs/data/auditoria-cupon-031016.json');

const CUPON = '031016';
const PCT = 50;

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };
const args = process.argv.slice(2);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function catalogo() {
  const out = [];
  for (const f of readdirSync(CURSOS).filter((x) => x.endsWith('.mdx'))) {
    const slug = f.replace(/\.mdx$/, '');
    if (args.includes('--solo') && args[args.indexOf('--solo') + 1] !== slug) continue;
    const crudo = readFileSync(path.join(CURSOS, f), 'utf8');
    const url = crudo.match(/^hotmartUrl:\s*(\S+)/m)?.[1];
    const proveedor = crudo.match(/^proveedor:\s*(\S+)/m)?.[1] ?? null;
    if (url && !url.includes('PENDIENTE')) out.push({ slug, url, proveedor });
  }
  return out;
}

async function resolver(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const html = await r.text();
  return { final: r.url, html };
}

/** Mismos pares `numero,"XXX"` que usa hotmart-precios.mjs. */
function extraerPrecios(html) {
  const vistos = new Map();
  for (const m of html.matchAll(/(\d{1,9}(?:\.\d{1,2})?),"([A-Z]{3})"/g)) {
    const monto = Number(m[1]);
    if (!vistos.has(m[2]) && monto > 0) vistos.set(m[2], monto);
  }
  return vistos;
}

/** Nombre del vendedor si el payload lo trae; para bautizar proveedores nuevos. */
function extraerVendedor(html) {
  for (const re of [
    /"seller":\s*\{[^}]{0,200}?"name":"([^"]{2,60})"/,
    /"sellerName":"([^"]{2,60})"/,
    /"producer":\s*\{[^}]{0,200}?"name":"([^"]{2,60})"/,
  ]) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

const conCupon = (url) => `${url}${url.includes('?') ? '&' : '?'}offDiscount=${CUPON}`;

async function auditar({ slug, url, proveedor }, porProducto) {
  const sin = await resolver(url);
  const producto = sin.final.match(/pay\.hotmart\.com\/([A-Z0-9]+)/i)?.[1] ?? null;

  // Dos entradas de catálogo del mismo producto comparten checkout: se mide una vez.
  if (producto && porProducto.has(producto)) {
    return { slug, proveedor, producto, ...porProducto.get(producto), compartido: true };
  }

  const preciosSin = extraerPrecios(sin.html);
  await dormir(250);
  const con = await resolver(conCupon(url));
  const preciosCon = extraerPrecios(con.html);

  const monedas = [...preciosSin.keys()].filter((m) => preciosCon.has(m));
  // USD es la más estable entre visitas; si no está, la primera común.
  const moneda = monedas.includes('USD') ? 'USD' : monedas[0];
  if (!moneda) throw new Error('sin moneda comparable entre las dos visitas');

  const base = preciosSin.get(moneda);
  const rebajado = preciosCon.get(moneda);
  const ratio = rebajado / base;
  // Un cupón del 50 % deja el ratio en ~0,50. Margen por redondeos e impuestos.
  const aplica = ratio <= 1 - PCT / 100 + 0.1;

  const res = {
    aplica,
    moneda,
    base,
    rebajado,
    ratio: Math.round(ratio * 1000) / 1000,
    vendedor: extraerVendedor(sin.html) ?? extraerVendedor(con.html),
    checkout: sin.final.split('?')[0],
  };
  if (producto) porProducto.set(producto, res);
  return { slug, proveedor, producto, ...res, compartido: false };
}

async function main() {
  const cursos = catalogo();
  console.log(`Auditando el cupón ${CUPON} (−${PCT} %) en ${cursos.length} cursos…\n`);

  const porProducto = new Map();
  const resultados = [];
  let hechos = 0;

  // Concurrencia 3: rápido sin parecer un ataque.
  const cola = [...cursos];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (;;) {
        const c = cola.shift();
        if (!c) return;
        try {
          resultados.push(await auditar(c, porProducto));
        } catch (err) {
          resultados.push({ slug: c.slug, proveedor: c.proveedor, error: err.message });
        }
        hechos += 1;
        if (hechos % 10 === 0) process.stdout.write(`  ${hechos}/${cursos.length}\n`);
        await dormir(300);
      }
    }),
  );

  resultados.sort((a, b) => a.slug.localeCompare(b.slug));
  const noAplica = resultados.filter((r) => !r.error && !r.aplica);
  const errores = resultados.filter((r) => r.error);

  mkdirSync(path.dirname(SALIDA), { recursive: true });
  writeFileSync(
    SALIDA,
    `${JSON.stringify({ cupon: CUPON, pct: PCT, generado: new Date().toISOString(), resultados }, null, 1)}\n`,
  );

  console.log(`\n✅ Aplica:    ${resultados.length - noAplica.length - errores.length}`);
  console.log(`🔴 NO aplica: ${noAplica.length}`);
  console.log(`⚠️  Error:     ${errores.length}\n`);
  for (const r of noAplica) {
    console.log(
      `  🔴 ${r.slug}  ratio ${r.ratio} (${r.base} → ${r.rebajado} ${r.moneda})` +
        `${r.vendedor ? `  vendedor: ${r.vendedor}` : ''}${r.proveedor ? `  [ya marcado: ${r.proveedor}]` : ''}`,
    );
  }
  for (const r of errores) console.log(`  ⚠️  ${r.slug}: ${r.error}`);
  console.log(`\n→ ${path.relative(RAIZ, SALIDA)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
