#!/usr/bin/env node
/**
 * Compara el precio que pinta la ficha con el «Total a pagar» que Hotmart
 * enseña por defecto en el país (pago con tarjeta, con IVA donde lo hay).
 *
 *   node scripts/verificar-precio-hotmart.mjs                       # producción, muestra de 4 fichas
 *   node scripts/verificar-precio-hotmart.mjs --base http://localhost:4321
 *   node scripts/verificar-precio-hotmart.mjs --ficha co/curso-de-masajes --ficha mx/curso-de-unas-acrilicas
 *   node scripts/verificar-precio-hotmart.mjs --json informe.json
 *
 * Solo lee: la ficha tal como la recibe un visitante (con su caché) y la
 * cotización pública del pago de Hotmart, la misma petición que hace el
 * servidor en src/lib/checkout-price.ts. No abre el formulario de pago, no
 * envía datos y no compra nada. Dos peticiones a Hotmart por ficha, espaciadas.
 *
 * Sale con código 1 si alguna ficha enseña un importe distinto al de Hotmart
 * más allá de la vida de la cotización (una hora). Dentro de esa hora la
 * diferencia es un aviso: Hotmart acaba de mover la tasa de cambio y la ficha
 * se pone al día sola.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { currencies, readAmount } from '../src/lib/hotmart-evidencia.mjs';

/** Vida de la cotización en la ficha (src/lib/checkout-price.ts) más el margen de la copia en el borde. */
export const VIDA_COTIZACION_MS = 3_600_000;
const MARGEN_MS = 600_000;
const MUESTRA = ['co/curso-de-masajes', 'mx/curso-de-unas-acrilicas', 'ec/curso-de-pasteleria', 'co/curso-de-soldadura'];
const UA = 'Mozilla/5.0 (compatible; sably-precio-test/1.0; +https://sably.co)';

/** «$ 186.134 COP», «$1,173.92 MXN», «$49,99 USD», «$25 USD» → número. */
export function leerImporte(texto) {
  const cifra = String(texto ?? '').match(/\d[\d.,\s]*/)?.[0].replace(/\s/g, '').replace(/[.,]$/, '');
  if (!cifra) return null;
  const decimal = cifra.match(/[.,](\d{1,2})$/);
  const entero = (decimal ? cifra.slice(0, decimal.index) : cifra).replace(/[.,]/g, '');
  const valor = Number(decimal ? `${entero}.${decimal[1]}` : entero);
  return Number.isFinite(valor) ? valor : null;
}

const atributo = (etiqueta, nombre) => etiqueta.match(new RegExp(`\\s${nombre}="([^"]*)"`))?.[1]?.replace(/&amp;/g, '&') ?? null;
const numero = (valor) => (valor === null || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor));

/** Lo que la ficha afirma sobre su precio: caja de compra y `Offer` del JSON-LD. */
export function leerFicha(html) {
  const caja = html.match(/<section\b[^>]*\sdata-purchase-panel\b[^>]*>/)?.[0];
  if (!caja) return null;
  const base = numero(atributo(caja, 'data-base-amount')) ?? leerImporte(atributo(caja, 'data-base'));
  const rebajado = numero(atributo(caja, 'data-reduced-amount')) ?? leerImporte(atributo(caja, 'data-reduced'));
  const enlace = atributo(caja, 'data-discount-url');
  let cupon = null;
  try { cupon = enlace ? new URL(enlace).searchParams.get('offDiscount') : null; } catch { /* enlace ilegible: sin cupón */ }
  let oferta = null;
  for (const bloque of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const nodos = [JSON.parse(bloque[1])].flat().flatMap((n) => n?.['@graph'] ?? [n]);
      const curso = nodos.find((n) => [n?.['@type']].flat().includes('Course') && n.offers);
      if (curso) oferta = [curso.offers].flat()[0];
    } catch { /* JSON-LD roto: lo señala seo:test */ }
  }
  return {
    moneda: atributo(caja, 'data-currency') ?? atributo(caja, 'data-base')?.trim().split(/\s+/).at(-1) ?? null,
    base, rebajado, cupon,
    fuente: atributo(caja, 'data-quote-source'),
    leida: numero(atributo(caja, 'data-quote-at')),
    oferta: oferta ? { precio: numero(String(oferta.price)), moneda: oferta.priceCurrency ?? null, hasta: oferta.priceValidUntil ?? null } : null,
  };
}

const igual = (a, b) => a !== null && b !== null && Math.abs(a - b) < 0.005;

/**
 * Veredicto de una ficha. `hotmart` = { base, rebajado } leídos ahora mismo.
 * error: la ficha enseña otro importe y su cotización ya debería haber caducado.
 * aviso: difiere dentro de la vida de la cotización, o muestra el precio de respaldo.
 */
export function comparar(ficha, hotmart, ahora = Date.now()) {
  const hallazgos = [];
  const anotar = (nivel, detalle) => hallazgos.push({ nivel, detalle });
  if (!ficha) return [{ nivel: 'error', detalle: 'La ficha no tiene caja de compra (data-purchase-panel).' }];
  if (!hotmart || hotmart.base === null) return [{ nivel: 'aviso', detalle: 'Hotmart no devolvió una cotización legible; no se pudo comparar.' }];
  const reciente = ficha.leida !== null && ahora - ficha.leida <= VIDA_COTIZACION_MS + MARGEN_MS;
  const nivel = reciente ? 'aviso' : 'error';
  const cuando = ficha.leida === null ? 'sin fecha de lectura' : `leída hace ${Math.round((ahora - ficha.leida) / 60000)} min`;
  if (ficha.fuente === 'respaldo') anotar('aviso', 'La ficha muestra el precio de respaldo: el servidor no pudo cotizar en Hotmart.');
  if (!igual(ficha.base, hotmart.base)) anotar(ficha.fuente === 'respaldo' ? 'aviso' : nivel, `Precio sin cupón: ficha ${ficha.base} ${ficha.moneda}, Hotmart ${hotmart.base} (${cuando}).`);
  if (ficha.cupon) {
    if (hotmart.rebajado === null) anotar('error', `La ficha ofrece el cupón ${ficha.cupon} y Hotmart no lo aplica.`);
    else if (!igual(ficha.rebajado, hotmart.rebajado)) anotar(nivel, `Precio con cupón ${ficha.cupon}: ficha ${ficha.rebajado} ${ficha.moneda}, Hotmart ${hotmart.rebajado} (${cuando}).`);
  }
  const visible = ficha.cupon ? ficha.rebajado : ficha.base;
  if (ficha.oferta && !igual(ficha.oferta.precio, visible)) anotar('error', `El Offer del JSON-LD dice ${ficha.oferta.precio} y la caja ${visible}.`);
  if (ficha.oferta && ficha.moneda && ficha.oferta.moneda !== ficha.moneda) anotar('error', `El Offer del JSON-LD está en ${ficha.oferta.moneda} y la caja en ${ficha.moneda}.`);
  return hallazgos;
}

async function cotizar(fuente, mercado, cupon) {
  const respuesta = await fetch('https://pay.hotmart.com/api/next/load', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', origin: 'https://pay.hotmart.com', referer: `https://pay.hotmart.com/${fuente.codigo}` },
    body: JSON.stringify({ items: [{ affiliation: fuente.codigo, quantity: 1, ...(cupon ? { coupon: cupon } : {}) }], countryIsoCode: mercado, device: 'DESKTOP' }),
  });
  return respuesta.ok ? respuesta.json() : null;
}

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function main() {
  const args = process.argv.slice(2);
  const opcion = (nombre) => { const i = args.indexOf(`--${nombre}`); return i >= 0 ? args[i + 1] : undefined; };
  const opciones = (nombre) => args.flatMap((a, i) => (a === `--${nombre}` ? [args[i + 1]] : []));
  const base = (opcion('base') ?? 'https://sably.co').replace(/\/$/, '');
  const fichas = opciones('ficha').length ? opciones('ficha') : MUESTRA;
  const fuentes = JSON.parse(readFileSync(new URL('../src/data/fuentes-precios.json', import.meta.url), 'utf8'));
  const informe = [];
  for (const ruta of fichas) {
    const [pais, slug] = ruta.replace(/^\/|\/$/g, '').split('/');
    const mercado = pais.toUpperCase();
    const fuente = fuentes[slug];
    const fila = { ficha: `/${pais}/${slug}/`, hallazgos: [] };
    informe.push(fila);
    if (!fuente || !currencies[mercado]) { fila.hallazgos.push({ nivel: 'error', detalle: 'Sin fuente de precio comprobada para este curso o país.' }); continue; }
    const pagina = await fetch(`${base}${fila.ficha}`, { headers: { 'user-agent': UA } }).catch(() => null);
    if (!pagina?.ok) { fila.hallazgos.push({ nivel: 'error', detalle: `La ficha respondió ${pagina?.status ?? 'sin conexión'}.` }); continue; }
    const ficha = leerFicha(await pagina.text());
    const fila_ = { product: fuente.product, market: mercado, currency: currencies[mercado], coupon: ficha?.cupon ?? null };
    const sinCupon = await cotizar(fuente, mercado, null).catch(() => null);
    await pausa(1200);
    const conCupon = ficha?.cupon ? await cotizar(fuente, mercado, ficha.cupon).catch(() => null) : null;
    await pausa(1200);
    const hotmart = { base: sinCupon ? readAmount(sinCupon, fila_, fuente, false) : null, rebajado: conCupon ? readAmount(conCupon, fila_, fuente, true) : null };
    Object.assign(fila, { ficha_: ficha, hotmart, hallazgos: comparar(ficha, hotmart) });
  }
  let errores = 0;
  for (const fila of informe) {
    const peor = fila.hallazgos.some((h) => h.nivel === 'error') ? 'ERROR' : fila.hallazgos.length ? 'aviso' : 'ok';
    if (peor === 'ERROR') errores++;
    const f = fila.ficha_;
    console.log(`${peor.padEnd(5)} ${fila.ficha}  ficha ${f ? `${f.rebajado ?? '—'} / ${f.base} ${f.moneda}` : '—'}  ·  Hotmart ${fila.hotmart ? `${fila.hotmart.rebajado ?? '—'} / ${fila.hotmart.base}` : '—'}`);
    for (const h of fila.hallazgos) console.log(`        ${h.nivel}: ${h.detalle}`);
  }
  if (opcion('json')) writeFileSync(opcion('json'), JSON.stringify({ base, fecha: new Date().toISOString(), informe }, null, 2));
  console.log(`\n${informe.length} fichas comparadas con Hotmart, ${errores} con error.`);
  process.exit(errores ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
