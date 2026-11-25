import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requisitosDeFicha } from '../src/lib/requisitos';

test('usa los requisitos del país y descarta los que nombran a un instructor de relleno', () => {
  const r = requisitosDeFicha(['Tener una camilla', 'Internet para ver las lecciones de Andrés Villamil.'], 'Principiante');
  assert.deepEqual(r, ['Tener una camilla']);
});

test('sin requisitos válidos, solo promete «sin experiencia» donde el nivel lo permite', () => {
  assert.equal(requisitosDeFicha(undefined, 'Principiante')[0], 'No necesitas experiencia previa');
  assert.equal(requisitosDeFicha([], 'Todos los niveles')[0], 'No necesitas experiencia previa');
  assert.ok(!requisitosDeFicha(['Lecciones de Andrés Villamil'], 'Intermedio').includes('No necesitas experiencia previa'));
});
