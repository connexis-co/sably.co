import assert from 'node:assert/strict';
import test from 'node:test';
import { mostrarPromedio, mostrarReparto, notaHotmart } from '../src/lib/opiniones';

test('promedio desde 5 opiniones y reparto desde 10', () => {
  assert.equal(mostrarPromedio(4), false);
  assert.equal(mostrarPromedio(5), true);
  assert.equal(mostrarReparto(9), false);
  assert.equal(mostrarReparto(10), true);
});

test('la nota de Hotmart va con su fuente y la fecha de lectura, y no se pinta con pocas calificaciones', () => {
  const capturado = Date.parse('2026-11-24T15:00:00Z') / 1000;
  assert.deepEqual(notaHotmart({ rating: 4.3, total: 10, capturado }, Date.parse('2026-11-25T00:00:00Z')), { cifra: '4,3', texto: '10 calificaciones en Hotmart, leídas el 24 nov. 2026' });
  assert.equal(notaHotmart({ rating: 5, total: 1, capturado }), null, 'una sola calificación de 5,0 no se muestra');
  assert.equal(notaHotmart(null), null);
  assert.equal(notaHotmart({ rating: 4.8, total: 31 })!.texto, '31 calificaciones en Hotmart');
});
