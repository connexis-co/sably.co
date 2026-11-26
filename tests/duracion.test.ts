import assert from 'node:assert/strict';
import test from 'node:test';
import { duracionCorta, duracionCurso, duracionIso, duracionLarga, minutosRedondeados, segundosDeVideo } from '../src/lib/duracion.ts';

test('redondea a 5 minutos y formatea corta, larga e ISO', () => {
  const canto = 1 * 3600 + 10 * 60 + 32; // 01:10:32
  assert.equal(minutosRedondeados(canto), 70);
  assert.equal(duracionCorta(canto), '1 h 10 min');
  assert.equal(duracionLarga(canto), '1 h 10 min de vídeo');
  assert.equal(duracionIso(canto), 'PT1H10M');
  assert.equal(duracionCorta(45 * 60), '45 min');
  assert.equal(duracionIso(45 * 60), 'PT45M');
  assert.equal(duracionCorta(3 * 3600 + 100), '3 h');
  assert.equal(duracionIso(3 * 3600 + 100), 'PT3H');
  assert.equal(duracionCorta(2 * 3600 + 57 * 60 + 40), '3 h');
  assert.equal(duracionCorta(60), '5 min');
});

test('sin dato no devuelve nada (ni «0 h» ni separador)', () => {
  for (const v of [null, undefined, 0, -5, Number.NaN]) {
    assert.equal(duracionCorta(v), '');
    assert.equal(duracionLarga(v), '');
    assert.equal(duracionIso(v), null);
  }
  assert.equal(segundosDeVideo('curso-que-no-existe'), null);
  assert.equal(duracionCurso.corta('curso-que-no-existe'), '');
});

test('la lista medida solo tiene cursos verificados con todas sus partes: extensiones (3:09:53 + 2:43:01)', () => {
  assert.equal(segundosDeVideo('curso-de-extensiones-de-cabello'), 21174);
  assert.equal(duracionCurso.larga('curso-de-extensiones-de-cabello'), '5 h 55 min de vídeo');
  assert.equal(duracionCurso.iso('curso-de-extensiones-de-cabello'), 'PT5H55M');
  // Medidos solo con la primera parte: fuera hasta sumar todas.
  assert.equal(segundosDeVideo('curso-de-canto'), null);
  assert.equal(segundosDeVideo('curso-de-barista'), null);
  assert.equal(duracionCurso.corta('curso-de-masajes'), '');
});
