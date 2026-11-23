import assert from 'node:assert/strict';
import test from 'node:test';
import { listaMonedas } from '../src/lib/moneda';
import { operationalPrice, type OperationalData } from '../src/plugins/sably-operations/public';

test('la portada nombra las monedas que de verdad muestran las tarjetas', () => {
  assert.equal(listaMonedas(['USD', 'USD'], 'ARS'), 'USD');
  assert.equal(listaMonedas(['COP', 'USD', 'COP'], 'COP'), 'COP y USD');
  assert.equal(listaMonedas(['USD', 'EUR', 'MXN'], 'MXN'), 'MXN, EUR y USD');
  assert.equal(listaMonedas([], 'CLP'), 'CLP');
});

test('Argentina sin precio en ARS cae al dólar, igual que la tarjeta', () => {
  const data: OperationalData = { prices: { barberia: { USD: 49.99 }, cocina: { COP: 165000, USD: 49.99 } }, ratings: {} };
  assert.equal(operationalPrice(data, 'barberia', { currency: 'ARS' })?.moneda, 'USD');
  assert.equal(operationalPrice(data, 'cocina', { currency: 'COP' })?.moneda, 'COP');
});
