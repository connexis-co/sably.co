import assert from 'node:assert/strict';
import test from 'node:test';
import { importeParaOrdenar, precioDeTarjeta, type CotizacionCurso } from '../src/lib/precio-tarjeta';

const base: CotizacionCurso = { sinProducto: false, conPrecio: true, currency: 'COP', baseAmount: 191012, reduced: null, coupon: null, saving: 0 };

test('con campaña que aplica: hoy el rebajado y el normal para tachar (masajes CO, 25-nov)', () => {
  assert.deepEqual(precioDeTarjeta({ ...base, reduced: 95506, coupon: '031016', saving: 50 }),
    { hoy: 95506, normal: 191012, moneda: 'COP', cupon: '031016', ahorro: 50 });
});

test('sin campaña (o cupón que el creador no acepta): solo el precio normal de la ficha', () => {
  assert.deepEqual(precioDeTarjeta(base), { hoy: 191012, normal: null, moneda: 'COP', cupon: null, ahorro: null });
  assert.deepEqual(precioDeTarjeta({ ...base, reduced: 95506, coupon: null }), { hoy: 191012, normal: null, moneda: 'COP', cupon: null, ahorro: null });
});

test('un «rebajado» que no baja no se presenta como descuento', () => {
  assert.equal(precioDeTarjeta({ ...base, reduced: 191012, coupon: '031016' })?.normal, null);
});

test('sin producto o sin precio de Hotmart la tarjeta no enseña cifra (nunca una de relleno)', () => {
  assert.equal(precioDeTarjeta({ ...base, sinProducto: true }), null);
  assert.equal(precioDeTarjeta({ ...base, conPrecio: false }), null);
  assert.equal(precioDeTarjeta({ ...base, baseAmount: 0 }), null);
});

test('ordenar por precio: USD convertido solo para comparar, sin precio al final y sin NaN', () => {
  const cop = precioDeTarjeta(base);
  const usd = precioDeTarjeta({ ...base, currency: 'USD', baseAmount: 49.99 });
  assert.equal(importeParaOrdenar(cop, 3800, 'COP'), 191012);
  assert.equal(importeParaOrdenar(usd, 3800, 'COP'), 49.99 * 3800);
  assert.equal(importeParaOrdenar(usd, 1, 'USD'), 49.99);
  const sin = importeParaOrdenar(null, 3800, 'COP');
  assert.ok(sin > importeParaOrdenar(cop, 3800, 'COP'));
  assert.equal(sin - sin, 0);
});
