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
