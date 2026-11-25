import assert from 'node:assert/strict';
import test from 'node:test';
import { comparar, leerFicha, leerImporte, VIDA_COTIZACION_MS } from './verificar-precio-hotmart.mjs';

const caja = (extra = '') => `<main><section id="compra" tabindex="-1" data-purchase-panel data-base="$ 191.012 COP" data-reduced="$ 95.506 COP"
  data-original-url="https://hotm.io/x?src=sably&amp;countrycode=CO" data-discount-url="https://hotm.io/x?src=sably&amp;countrycode=CO&amp;offDiscount=031016"
  data-until="1795651200000"${extra}><h2>Opciones de compra</h2></section></main>
<script type="application/ld+json">{"@context":"https://schema.org","@type":["Product","Course"],"name":"Curso","offers":{"@type":"Offer","price":"95506","priceCurrency":"COP","priceValidUntil":"2026-11-25"}}</script>`;

test('lee los importes con el formato de cada país', () => {
  assert.equal(leerImporte('$ 186.134 COP'), 186134);
  assert.equal(leerImporte('$1,173.92 MXN'), 1173.92);
  assert.equal(leerImporte('$49,99 USD'), 49.99);
  assert.equal(leerImporte('$25 USD'), 25);
  assert.equal(leerImporte('$ 1.250.000,50 ARS'), 1250000.5);
  assert.equal(leerImporte('S/ 95.00 PEN'), 95);
  assert.equal(leerImporte('Próximamente'), null);
});

test('saca de la ficha el precio de la caja, el cupón y el Offer', () => {
  const vieja = leerFicha(caja());
  assert.deepEqual([vieja.base, vieja.rebajado, vieja.moneda, vieja.cupon, vieja.leida], [191012, 95506, 'COP', '031016', null]);
  assert.deepEqual(vieja.oferta, { precio: 95506, moneda: 'COP', hasta: '2026-11-25' });
  const nueva = leerFicha(caja(' data-currency="COP" data-base-amount="191012" data-reduced-amount="95506" data-quote-source="hotmart" data-quote-at="1795575000000"'));
  assert.deepEqual([nueva.base, nueva.rebajado, nueva.fuente, nueva.leida], [191012, 95506, 'hotmart', 1795575000000]);
  assert.equal(leerFicha('<main><p>Próximamente</p></main>'), null);
});

test('la ficha que coincide con Hotmart pasa', () => {
  const ficha = leerFicha(caja(' data-quote-source="hotmart" data-quote-at="1000"'));
  assert.deepEqual(comparar(ficha, { base: 191012, rebajado: 95506 }, 2000), []);
});

test('una diferencia es aviso dentro de la vida de la cotización y error después', () => {
  const ficha = leerFicha(caja(' data-quote-source="hotmart" data-quote-at="1000"').replaceAll('191.012', '186.134').replaceAll('95.506', '93.067').replace('"95506"', '"93067"'));
  const hotmart = { base: 191012, rebajado: 95506 };
  assert.deepEqual(comparar(ficha, hotmart, 1000 + 60_000).map((h) => h.nivel), ['aviso', 'aviso']);
  assert.deepEqual(comparar(ficha, hotmart, 1000 + VIDA_COTIZACION_MS * 2).map((h) => h.nivel), ['error', 'error']);
  // Sin fecha de lectura (ficha anterior a este control) no hay excusa: es error.
  assert.deepEqual(comparar({ ...ficha, leida: null }, hotmart).map((h) => h.nivel), ['error', 'error']);
});

test('el Offer no puede contradecir a la caja ni la ficha ofrecer un cupón que Hotmart no aplica', () => {
  const ficha = leerFicha(caja(' data-quote-source="hotmart" data-quote-at="1000"'));
  assert.match(comparar({ ...ficha, oferta: { precio: 191012, moneda: 'COP', hasta: null } }, { base: 191012, rebajado: 95506 }, 2000)[0].detalle, /JSON-LD dice 191012 y la caja 95506/);
  assert.match(comparar(ficha, { base: 191012, rebajado: null }, 2000)[0].detalle, /Hotmart no lo aplica/);
  assert.equal(comparar(null, { base: 1, rebajado: null })[0].nivel, 'error');
  assert.equal(comparar(ficha, { base: null, rebajado: null })[0].nivel, 'aviso');
});

test('el precio de respaldo se avisa, no se da por bueno', () => {
  const ficha = { ...leerFicha(caja()), fuente: 'respaldo', cupon: null, rebajado: null, base: 163800, oferta: null };
  assert.deepEqual(comparar(ficha, { base: 191012, rebajado: null }, 5000).map((h) => h.nivel), ['aviso', 'aviso']);
});

test('tarjetas: lee la cifra visible (y la tachada) de la tarjeta V2, la del héroe y la del clásico', async () => {
  const { leerTarjetas } = await import('./verificar-precio-hotmart.mjs');
  const precio = (v, c) => `<span class="v2-num"><span aria-hidden="true"><span>${v}</span> <span>${c}</span></span><span class="sr-only">${v} pesos</span></span>`;
  const v2 = `<article data-tarjeta-curso="curso-de-masajes"><h3><a href="/co/curso-de-masajes/">Masajes</a></h3><p>Desde $ 10 COP en la descripción</p>`
    + `<p class="v2-tc-precio"><span data-tc-precio>${precio('$ 95.506', 'COP')}<span><span class="sr-only">Precio normal: </span>${precio('$ 191.012', 'COP')}</span></span></p></article>`
    + `<article><a href="/co/curso-de-velas/">Oficio destacado sin precio</a></article>`
    + `<a href="/co/curso-de-masajes/" data-tarjeta-heroe class="relative -mt-10"><strong>Masajes</strong>${precio('$ 95.506', 'COP')}</a>`;
  assert.deepEqual(leerTarjetas(v2, 'co'), [
    { slug: 'curso-de-masajes', lugar: 'tarjeta', precio: { hoy: 95506, moneda: 'COP', normal: 191012 } },
    { slug: 'curso-de-masajes', lugar: 'héroe', precio: { hoy: 95506, moneda: 'COP', normal: null } },
  ]);
  const mosaico = `<a href="/co/curso-de-barberia/" class="v2-mos-oficio" data-visible><picture></picture><span class="v2-mos-rotulo"><strong>Barbería</strong><span data-tc-precio>${precio('$ 95.506', 'COP')}<span><span class="sr-only">Precio normal: </span>${precio('$ 191.012', 'COP')}</span></span></span></a>`
    + `<a href="/co/curso-de-velas/" class="v2-mos-oficio"><span class="v2-mos-rotulo"><strong>Velas</strong></span></a>`;
  assert.deepEqual(leerTarjetas(mosaico, 'co'), [
    { slug: 'curso-de-barberia', lugar: 'mosaico', precio: { hoy: 95506, moneda: 'COP', normal: 191012 } },
    { slug: 'curso-de-velas', lugar: 'mosaico', precio: null },
  ]);
  const sinPrecio = '<article data-tarjeta-curso="curso-x"><p class="v2-tc-precio"><span></span></p></article>';
  assert.deepEqual(leerTarjetas(sinPrecio, 'co'), [{ slug: 'curso-x', lugar: 'tarjeta', precio: null }]);
  const euro = `<article data-tarjeta-curso="curso-y"><p class="v2-tc-precio">${precio('29,65 €', 'EUR')}</p></article>`;
  assert.equal(leerTarjetas(euro, 'es')[0].precio.hoy, 29.65);
  const clasico = '<article><a href="/co/curso-de-masajes/"><h3>Masajes</h3><div class="mt-auto flex items-baseline gap-2 pt-3"><span>$163.800 COP</span></div></a></article>';
  assert.deepEqual(leerTarjetas(clasico, 'co')[0].precio, { hoy: 163800, moneda: 'COP', normal: null });
});

test('tarjetas: error si la cifra, la moneda o el tachado no son los de la ficha (25-nov: 163.800 frente a 95.506)', async () => {
  const { compararTarjeta } = await import('./verificar-precio-hotmart.mjs');
  const ficha = leerFicha(caja(' data-currency="COP" data-base-amount="191012" data-reduced-amount="95506" data-quote-source="hotmart" data-quote-at="1000"'));
  assert.deepEqual(compararTarjeta({ precio: { hoy: 95506, moneda: 'COP', normal: 191012 } }, ficha), []);
  assert.equal(compararTarjeta({ precio: { hoy: 163800, moneda: 'COP', normal: null } }, ficha).filter((h) => h.nivel === 'error').length, 1);
  assert.ok(compararTarjeta({ precio: { hoy: 49.99, moneda: 'USD', normal: null } }, ficha).some((h) => /Moneda/.test(h.detalle)));
  assert.ok(compararTarjeta({ precio: { hoy: 95506, moneda: 'COP', normal: 200000 } }, ficha).some((h) => /Tachado/.test(h.detalle)));
  const sinPrecio = { ...ficha, estado: 'sin-precio' };
  assert.equal(compararTarjeta({ precio: { hoy: 163800, moneda: 'COP', normal: null } }, sinPrecio)[0].nivel, 'error');
  assert.deepEqual(compararTarjeta({ precio: null }, sinPrecio), []);
});

test('tarjetas: «US$» de España y fichas sin caja de compra', async () => {
  const { importesConMoneda, compararTarjeta } = await import('./verificar-precio-hotmart.mjs');
  assert.deepEqual(importesConMoneda('35,00 US$ USD'), [{ valor: 35, moneda: 'USD' }]);
  assert.deepEqual(compararTarjeta({ precio: null }, { sinCaja: true }), []);
  assert.equal(compararTarjeta({ precio: { hoy: 163800, moneda: 'COP', normal: null } }, { sinCaja: true })[0].nivel, 'error');
});
