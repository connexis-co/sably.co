#!/usr/bin/env node
/**
 * Compara el precio que pinta la ficha con el «Total a pagar» que Hotmart
 * enseña por defecto en el país (pago con tarjeta, con IVA donde lo hay).
 *
 *   node scripts/verificar-precio-hotmart.mjs                       # producción, muestra de 4 fichas
 *   node scripts/verificar-precio-hotmart.mjs --base http://localhost:4321
 *   node scripts/verificar-precio-hotmart.mjs --base https://dev.sably.co --tema v2   (con SABLY_DEV_PASSWORD)
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
 *
 * Después compara las TARJETAS con su ficha: en la portada y el listado de cada
 * país (los ocho por defecto), todas las tarjetas de la portada (también la del
 * héroe) y una muestra del listado. Error si una tarjeta enseña otro importe u
 * otra moneda que lo que su ficha da como precio a pagar hoy, o una cifra cuando
 * la ficha no tiene precio (25-nov: «$ 163.800 COP» en todas las tarjetas de
 * /co/ y 95.506/191.012 en la ficha de masajes).
 *
 *   --paises co,mx        solo esos países
 *   --por-listado 6       tarjetas del listado por país (repartidas); --todas = todas
 *   --sin-tarjetas        solo las fichas
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
    estado: atributo(caja, 'data-estado'),
    moneda: atributo(caja, 'data-currency') ?? atributo(caja, 'data-base')?.trim().split(/\s+/).at(-1) ?? null,
    base, rebajado, cupon,
    /* Lo que se lee en la caja (redondeado como lo pinta el tema: CLP sin decimales, por ejemplo). */
    baseVisible: leerImporte(atributo(caja, 'data-base')) ?? base,
    rebajadoVisible: leerImporte(atributo(caja, 'data-reduced')) ?? rebajado,
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
  if (ficha.fuente === 'respaldo') anotar('aviso', 'La ficha no muestra precio de Hotmart: el servidor no pudo cotizar y no tenía una cotización guardada.');
  if (ficha.fuente === 'guardada') anotar('aviso', `La ficha muestra la última cotización guardada (${cuando}): Hotmart no respondió a tiempo.`);
  if (ficha.estado === 'sin-precio') return hallazgos;
  if (!igual(ficha.base, hotmart.base)) anotar(ficha.fuente !== 'hotmart' ? 'aviso' : nivel, `Precio sin cupón: ficha ${ficha.base} ${ficha.moneda}, Hotmart ${hotmart.base} (${cuando}).`);
  if (ficha.cupon) {
    if (hotmart.rebajado === null) anotar('error', `La ficha ofrece el cupón ${ficha.cupon} y Hotmart no lo aplica.`);
    else if (!igual(ficha.rebajado, hotmart.rebajado)) anotar(nivel, `Precio con cupón ${ficha.cupon}: ficha ${ficha.rebajado} ${ficha.moneda}, Hotmart ${hotmart.rebajado} (${cuando}).`);
  }
  const visible = ficha.cupon ? ficha.rebajado : ficha.base;
  if (ficha.oferta && !igual(ficha.oferta.precio, visible)) anotar('error', `El Offer del JSON-LD dice ${ficha.oferta.precio} y la caja ${visible}.`);
  if (ficha.oferta && ficha.moneda && ficha.oferta.moneda !== ficha.moneda) anotar('error', `El Offer del JSON-LD está en ${ficha.oferta.moneda} y la caja en ${ficha.moneda}.`);
  return hallazgos;
}

const PAISES = ['co', 'mx', 'pe', 'ec', 'cl', 'ar', 'es', 'us'];
const sinEtiquetas = (html) => html.replace(/<span class="sr-only"[^>]*>[\s\S]*?<\/span>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');

/** «$ 95.506 COP $ 191.012 COP» → [{ valor: 95506, moneda: 'COP' }, …] (solo cifras con su código ISO). */
export function importesConMoneda(texto) {
  return [...texto.matchAll(/(\d[\d.,\s]*\d|\d)\s*(?:[A-Z]{0,3}[^\w\s]\s*)?([A-Z]{3})\b/g)].map((m) => ({ valor: leerImporte(m[1]), moneda: m[2] }));
}

/**
 * Tarjetas de curso de una página (tema V2 o clásico) y la cifra que enseñan a
 * la vista: `hoy` y, si la hay, la tachada (`normal`). `precio: null` = sin cifra.
 */
export function leerTarjetas(html, pais) {
  const tarjetas = [];
  const ruta = new RegExp(`href="/${pais}/([a-z0-9-]+)/"`);
  const agregar = (slug, trozo, lugar) => {
    const desde = ['data-tc-precio', 'v2-tc-precio', 'mt-auto flex items-baseline'].map((m) => trozo.indexOf(m)).find((i) => i >= 0) ?? 0;
    const importes = importesConMoneda(sinEtiquetas(trozo.slice(desde)));
    tarjetas.push({ slug, lugar, precio: importes.length ? { hoy: importes[0].valor, moneda: importes[0].moneda, normal: importes[1]?.valor ?? null } : null });
  };
  for (const m of html.matchAll(/<article\b[\s\S]*?<\/article>/g)) {
    /* Tarjeta de curso: la marcada o, en el HTML de antes y en el clásico, la que tiene hueco de precio
       (la portada tiene otros <article> con enlace a fichas que no son tarjetas con precio). */
    const marcada = m[0].match(/data-tarjeta-curso="([^"]+)"/)?.[1];
    const slug = marcada ?? (/v2-tc-precio|mt-auto flex items-baseline/.test(m[0]) ? m[0].match(ruta)?.[1] : null);
    if (slug) agregar(slug, m[0], 'tarjeta');
  }
  /* Tarjeta flotante del héroe de la portada V2 (un enlace, no un <article>). */
  const heroe = html.match(new RegExp(`<a href="/${pais}/([a-z0-9-]+)/"[^>]*(?:data-tarjeta-heroe|class="relative -mt-10)[^>]*>([\\s\\S]*?)</a>`));
  if (heroe) agregar(heroe[1], heroe[2], 'héroe');
  return tarjetas;
}

/** Errores de una tarjeta frente a su ficha (`leerFicha`). */
export function compararTarjeta(tarjeta, ficha) {
  const hallazgos = [];
  if (!ficha) return [{ nivel: 'error', detalle: 'La ficha no respondió: no se pudo comparar.' }];
  /* Ficha sin caja de compra (curso sin producto en Hotmart): la tarjeta tampoco puede dar cifra. */
  if (ficha.sinCaja) return tarjeta.precio ? [{ nivel: 'error', detalle: `La tarjeta dice ${tarjeta.precio.hoy} ${tarjeta.precio.moneda} y la ficha no vende (sin caja de compra).` }] : [];
  const sinPrecio = ficha.estado === 'sin-precio';
  const hoy = ficha.cupon ? ficha.rebajadoVisible : ficha.baseVisible;
  if (!tarjeta.precio) {
    if (!sinPrecio) hallazgos.push({ nivel: 'aviso', detalle: `La tarjeta no enseña precio y la ficha sí (${hoy} ${ficha.moneda}).` });
    return hallazgos;
  }
  const { precio } = tarjeta;
  if (sinPrecio) return [{ nivel: 'error', detalle: `La tarjeta dice ${precio.hoy} ${precio.moneda} y la ficha no tiene precio de Hotmart.` }];
  if (precio.moneda !== ficha.moneda) hallazgos.push({ nivel: 'error', detalle: `Moneda: tarjeta ${precio.moneda}, ficha ${ficha.moneda}.` });
  if (!igual(precio.hoy, hoy)) hallazgos.push({ nivel: 'error', detalle: `Precio: tarjeta ${precio.hoy} ${precio.moneda}, ficha ${hoy} ${ficha.moneda}${ficha.cupon ? ` (con cupón ${ficha.cupon}; sin cupón ${ficha.baseVisible})` : ''}.` });
  if (precio.normal !== null && !(ficha.cupon && igual(precio.normal, ficha.baseVisible))) hallazgos.push({ nivel: 'error', detalle: `Tachado: tarjeta ${precio.normal}, ficha ${ficha.cupon ? ficha.baseVisible : 'sin campaña'}.` });
  if (precio.normal === null && ficha.cupon) hallazgos.push({ nivel: 'aviso', detalle: `La ficha aplica el cupón ${ficha.cupon} y la tarjeta no tacha el normal.` });
  return hallazgos;
}

/** Tarjetas de portada y listado de un país, cada una contra su ficha. */
async function compararTarjetasDelPais({ base, pais, tema, cabeceras, porListado, todas }) {
  const consulta = (extra) => `?${new URLSearchParams({ ...(tema ? { tema } : {}), _t: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, ...extra })}`;
  const leer = async (ruta) => {
    const r = await fetch(`${base}${ruta}${consulta()}`, { headers: { 'user-agent': UA, ...cabeceras } }).catch(() => null);
    return r?.ok ? r.text() : null;
  };
  const filas = [];
  const [portada, listado] = await Promise.all([leer(`/${pais}/`), leer(`/${pais}/cursos/`)]);
  if (!portada) filas.push({ pagina: `/${pais}/`, hallazgos: [{ nivel: 'error', detalle: 'La portada no respondió.' }] });
  if (!listado) filas.push({ pagina: `/${pais}/cursos/`, hallazgos: [{ nivel: 'error', detalle: 'El listado no respondió.' }] });
  const deListado = listado ? leerTarjetas(listado, pais) : [];
  const paso = todas ? 1 : Math.max(1, Math.floor(deListado.length / Math.max(1, porListado)));
  const elegidas = [
    ...(portada ? leerTarjetas(portada, pais).map((t) => ({ ...t, pagina: `/${pais}/` })) : []),
    ...deListado.filter((_, i) => i % paso === 0).slice(0, todas ? undefined : porListado).map((t) => ({ ...t, pagina: `/${pais}/cursos/` })),
  ];
  const fichas = new Map();
  for (const slug of new Set(elegidas.map((t) => t.slug))) fichas.set(slug, null);
  const slugs = [...fichas.keys()];
  for (let i = 0; i < slugs.length; i += 4) {
    await Promise.all(slugs.slice(i, i + 4).map(async (slug) => { const html = await leer(`/${pais}/${slug}/`); fichas.set(slug, html ? (leerFicha(html) ?? { sinCaja: true }) : null); }));
  }
  for (const t of elegidas) filas.push({ pagina: t.pagina, lugar: t.lugar, slug: t.slug, tarjeta: t.precio, ficha: fichas.get(t.slug), hallazgos: compararTarjeta(t, fichas.get(t.slug)) });
  return { pais, tarjetasPortada: elegidas.filter((t) => t.pagina === `/${pais}/`).length, tarjetasListado: deListado.length, filas };
}

async function cotizar(fuente, mercado, cupon) {
  const respuesta = await fetch('https://pay.hotmart.com/api/next/load', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', origin: 'https://pay.hotmart.com', referer: `https://pay.hotmart.com/${fuente.codigo}` },
    // La oferta del enlace de compra cuando no es la por defecto (src/lib/checkout-price.ts, `Source.oferta`).
    body: JSON.stringify({ items: [{ affiliation: fuente.codigo, quantity: 1, ...(fuente.oferta ? { offer: fuente.oferta } : {}), ...(cupon ? { coupon: cupon } : {}) }], countryIsoCode: mercado, device: 'DESKTOP' }),
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
    const tema = opcion('tema');
    const cabeceras = process.env.SABLY_DEV_PASSWORD && !/^https:\/\/(?:www\.)?sably\.co$/.test(base)
      ? { authorization: `Basic ${Buffer.from(`sably:${process.env.SABLY_DEV_PASSWORD}`).toString('base64')}` } : {};
    const pagina = await fetch(`${base}${fila.ficha}${tema ? `?tema=${encodeURIComponent(tema)}` : ''}`, { headers: { 'user-agent': UA, ...cabeceras } }).catch(() => null);
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
  console.log(`\n${informe.length} fichas comparadas con Hotmart, ${errores} con error.`);
  const tarjetas = [];
  let erroresTarjetas = 0;
  if (!args.includes('--sin-tarjetas')) {
    const tema = opcion('tema');
    const cabeceras = process.env.SABLY_DEV_PASSWORD && !/^https:\/\/(?:www\.)?sably\.co$/.test(base)
      ? { authorization: `Basic ${Buffer.from(`sably:${process.env.SABLY_DEV_PASSWORD}`).toString('base64')}` } : {};
    const paises = opcion('paises') ? opcion('paises').split(',').map((p) => p.trim().toLowerCase()) : PAISES;
    console.log(`\nTarjetas frente a su ficha${tema ? ` (tema ${tema})` : ''}:`);
    for (const pais of paises) {
      const r = await compararTarjetasDelPais({ base, pais, tema, cabeceras, porListado: Number(opcion('por-listado') ?? 6), todas: args.includes('--todas') });
      tarjetas.push(r);
      const conError = r.filas.filter((f) => f.hallazgos.some((h) => h.nivel === 'error'));
      const conAviso = r.filas.filter((f) => !conError.includes(f) && f.hallazgos.length);
      erroresTarjetas += conError.length;
      console.log(`${conError.length ? 'ERROR' : conAviso.length ? 'aviso' : 'ok   '} /${pais}/  ${r.filas.length} tarjetas comparadas (portada ${r.tarjetasPortada}, listado ${r.tarjetasListado} en total), ${conError.length} con error, ${conAviso.length} con aviso`);
      for (const f of [...conError, ...conAviso].slice(0, 12)) {
        for (const h of f.hallazgos) console.log(`        ${h.nivel}: ${f.pagina} ${f.lugar ?? ''} ${f.slug ?? ''} · ${h.detalle}`);
      }
    }
    const total = tarjetas.reduce((n, r) => n + r.filas.length, 0);
    console.log(`\n${total} tarjetas comparadas con su ficha en ${tarjetas.length} países, ${erroresTarjetas} con error.`);
  }
  if (opcion('json')) writeFileSync(opcion('json'), JSON.stringify({ base, fecha: new Date().toISOString(), informe, tarjetas }, null, 2));
  process.exit(errores || erroresTarjetas ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
