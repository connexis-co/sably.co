import assert from 'node:assert/strict';
import test from 'node:test';
import { fuenteDeNotas, mostrarPromedio, mostrarReparto, notaHotmart } from '../src/lib/opiniones';
import { resumenTarjeta } from '../src/lib/presentacion-v2';

test('promedio desde 5 opiniones y reparto desde 10', () => {
  assert.equal(mostrarPromedio(4), false);
  assert.equal(mostrarPromedio(5), true);
  assert.equal(mostrarReparto(9), false);
  assert.equal(mostrarReparto(10), true);
});

test('la nota de Hotmart va con su fuente y la fecha de lectura, y no se pinta con pocas calificaciones', () => {
  const capturado = Date.parse('2026-11-24T15:00:00Z') / 1000;
  assert.deepEqual(notaHotmart({ rating: 4.3, total: 10, capturado }, Date.parse('2026-11-25T00:00:00Z')), {
    cifra: '4,3', numero: '10', total: 10, fecha: '24 nov. 2026', texto: '10 calificaciones en Hotmart, leídas el 24 nov. 2026',
    corto: '10 calificaciones', accesible: '4,3 de 5 en 10 calificaciones en Hotmart, leídas el 24 nov. 2026',
  });
  assert.equal(notaHotmart({ rating: 5, total: 1, capturado }), null, 'una sola calificación de 5,0 no se muestra');
  assert.equal(notaHotmart(null), null);
  assert.equal(notaHotmart({ rating: 4.8, total: 31 })!.texto, '31 calificaciones en Hotmart');
});

test('la línea corta no repite la fuente; el número lleva separador de miles', () => {
  const n = notaHotmart({ rating: 4.8, total: 1204 })!;
  assert.equal(`${n.cifra} · ${n.corto}`, '4,8 · 1.204 calificaciones');
  assert.equal(`${n.cifra} · ${n.numero}`, '4,8 · 1.204');
});

test('el pie del listado declara la fuente y la fecha una vez', () => {
  const ahora = Date.parse('2026-11-26T00:00:00Z');
  const oct = Date.parse('2026-10-02T15:00:00Z');
  const nov = Date.parse('2026-11-24T15:00:00Z');
  assert.equal(fuenteDeNotas([null, { rating: 4, total: 2 }], ahora), null);
  assert.match(fuenteDeNotas([{ rating: 4.4, total: 27, capturado: oct }, null], ahora)!, /en Hotmart.*leídas el 2 oct\. 2026\. Solo se muestran con 5 o más\.$/);
  assert.match(fuenteDeNotas([{ rating: 4.4, total: 27, capturado: oct }, { rating: 4.7, total: 47, capturado: nov }], ahora)!, /leídas entre el 2 oct\. 2026 y el 24 nov\. 2026/);
});

test('la descripción de la tarjeta no corta palabras ni repite el título', () => {
  assert.equal(resumenTarjeta('Curso de barbería online desde cero: máquina, fades y barba con navaja. Incluye certificado digital.'), 'Máquina, fades y barba con navaja.');
  assert.equal(resumenTarjeta('Curso de peluquería online de básico a avanzado. Corte, lavado, colorimetría, modelado capilar y el módulo para montar tu propio salón.'), 'Corte, lavado, colorimetría, modelado capilar…');
  assert.equal(resumenTarjeta('Aprende manicura profesional, diseña uñas en tendencia y crea tu propio negocio.'), 'Aprende manicura profesional, diseña uñas en tendencia…');
  assert.equal(resumenTarjeta('Curso corto.'), 'Curso corto.');
  assert.equal(resumenTarjeta(null), '');
  for (const t of ['Aprende a hornear y decorar galletas artesanales con glasé real y fondant para vender', 'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce']) {
    const r = resumenTarjeta(t);
    assert.ok(r.length <= 57, r);
    assert.ok(t.startsWith(r.replace(/…$/, '')), 'corta en un límite de palabra');
    assert.doesNotMatch(r, /\s(y|de|el|la|con)…$/);
  }
});
