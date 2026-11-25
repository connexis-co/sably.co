import assert from 'node:assert/strict';
import test from 'node:test';
import { fechaCorta, fraccionRestante, restante, textoRestante } from '../src/lib/cuenta-atras';

const hasta = Date.parse('2026-11-25T19:00:00-05:00');

test('el contador cuenta hasta la fecha real y se apaga al llegar', () => {
  assert.deepEqual(restante(hasta, hasta - (21 * 60 + 30) * 60_000), { dias: 0, horas: 21, minutos: 30 });
  assert.equal(textoRestante(restante(hasta, hasta - (21 * 60 + 30) * 60_000)!), '21 h 30 min');
  assert.equal(textoRestante(restante(hasta, hasta - (2 * 1440 + 3 * 60) * 60_000)!), '2 d 3 h');
  assert.equal(textoRestante(restante(hasta, hasta - 59_000)!), '1 min');
  assert.equal(restante(hasta, hasta), null);
  assert.equal(restante(hasta, hasta + 1), null, 'nunca vuelve a empezar');
});

test('la barra recorre la campaña entera', () => {
  const desde = hasta - 10 * 86_400_000;
  assert.equal(fraccionRestante(desde, hasta, desde), 1);
  assert.equal(fraccionRestante(desde, hasta, desde + 5 * 86_400_000), 0.5);
  assert.equal(fraccionRestante(desde, hasta, hasta + 1), 0);
  assert.equal(fraccionRestante(null, hasta, hasta - 1), 1);
});

test('la fecha se dice en hora de Colombia', () => {
  assert.equal(fechaCorta(hasta), '25 nov., 7:00 p. m.');
  assert.equal(fechaCorta(Date.parse('2026-12-01T09:05:00-05:00')), '1 dic., 9:05 a. m.');
});
