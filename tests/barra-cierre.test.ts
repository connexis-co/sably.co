import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desplazamientosCierre } from '../src/lib/barra-cierre.ts';

test('arriba del todo, cabecera y contenido suben el alto entero de la barra', () => {
  assert.deepEqual(desplazamientosCierre(48, 0, true), { cabecera: 48, contenido: 48 });
  assert.deepEqual(desplazamientosCierre(72, 0, false), { cabecera: 72, contenido: 72 });
});

test('fija y con la página bajada, solo sube la cabecera; el contenido no se mueve', () => {
  assert.deepEqual(desplazamientosCierre(48, 1500, true), { cabecera: 48, contenido: 0 });
});

test('a medio pasar, el contenido sube lo que aún se veía de la barra', () => {
  assert.deepEqual(desplazamientosCierre(72, 30, false), { cabecera: 42, contenido: 42 });
  assert.deepEqual(desplazamientosCierre(72, 30, true), { cabecera: 72, contenido: 42 });
});

test('sin fijar y ya fuera de la vista, nada que animar', () => {
  assert.deepEqual(desplazamientosCierre(48, 600, false), { cabecera: 0, contenido: 0 });
});
