import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as model from '../src/lib/caja/model';
import * as fabrica from '../src/lib/caja/fabrica';
import * as parche from '../src/lib/caja/parche';
import * as resolver from '../src/lib/caja/resolver';
import * as validar from '../src/lib/caja/validar';
import * as migrar from '../src/lib/caja/migrar';
import { ejecutar } from './caja-paridad-casos';

const referencia = JSON.parse(readFileSync(new URL('./fixtures/caja-paridad.json', import.meta.url), 'utf8'));

test('el núcleo de caja es copia exacta del de la academia (validar.ts solo cambia sus importaciones)', () => {
  for (const m of ['model', 'fabrica', 'parche', 'resolver', 'validar', 'migrar']) {
    const huella = createHash('sha256').update(readFileSync(new URL(`../src/lib/caja/${m}.ts`, import.meta.url))).digest('hex');
    assert.equal(huella, referencia.huellas[m], `${m}.ts se separó del núcleo de la academia ${referencia.academia.slice(0, 7)}: porta el cambio en los dos sitios y regenera con scripts/caja-paridad.mjs`);
  }
});

test('mismas entradas, misma salida que el núcleo de la academia', () => {
  const salidas = ejecutar({ model, fabrica, parche, resolver, validar, migrar });
  for (const [caso, esperado] of Object.entries(referencia.salidas)) assert.deepEqual(salidas[caso], esperado, `caso «${caso}»`);
  assert.deepEqual(Object.keys(salidas).sort(), Object.keys(referencia.salidas).sort());
});
