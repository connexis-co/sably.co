import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerSonido } from '../src/components/v2/medios/controlador';

test('leerSonido: devuelve lo guardado y descarta valores rotos o fuera de rango', () => {
  const datos = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => datos.get(k) ?? null };
  assert.equal(leerSonido(), undefined);
  datos.set('sably:medio:sonido', JSON.stringify({ volumen: 0.4, mudo: true }));
  assert.deepEqual(leerSonido(), { volumen: 0.4, mudo: true });
  for (const malo of ['{"volumen":3}', '{"volumen":"x"}', 'no es json']) {
    datos.set('sably:medio:sonido', malo);
    assert.equal(leerSonido(), undefined, malo);
  }
  delete (globalThis as { localStorage?: unknown }).localStorage;
  assert.equal(leerSonido(), undefined);
});
