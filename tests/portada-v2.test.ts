/**
 * Portada de país V2: orden de bloques desde el panel y mosaico del héroe (docs/equipo/2026-11-25/portada/DISENO.md).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bloquesVisibles, bloquesParaElPanel, ORDEN_DE_FABRICA, listaDeTexto } from '../src/lib/portada-bloques.ts';
import { inventarioMosaico, repartirEnCeldas, type CursoMosaico } from '../src/themes/sably-v2/portada.ts';

test('sin nada guardado, la portada sale en el orden de fábrica y con todo encendido', () => {
  assert.deepEqual(bloquesVisibles(undefined, undefined), [...ORDEN_DE_FABRICA]);
  assert.deepEqual(bloquesVisibles('', ''), [...ORDEN_DE_FABRICA]);
});

test('el orden guardado manda; los ids desconocidos se ignoran y los que faltan entran en su sitio', () => {
  const orden = bloquesVisibles('cierre, cifras ,xx, preguntas', '');
  assert.equal(orden[0], 'cierre');
  assert.equal(orden[1], 'cifras');
  // categorias va detrás de cifras, como en fábrica; preguntas conserva su sitio guardado.
  assert.equal(orden[2], 'categorias');
  assert.deepEqual([...orden].sort(), [...ORDEN_DE_FABRICA].sort());
  assert.equal(orden.length, ORDEN_DE_FABRICA.length);
});

test('apagar un bloque lo quita y no mueve los demás', () => {
  const orden = bloquesVisibles('', 'promo,videos');
  assert.ok(!orden.includes('promo') && !orden.includes('videos'));
  assert.deepEqual(orden, ORDEN_DE_FABRICA.filter(b => b !== 'promo' && b !== 'videos'));
  assert.deepEqual(bloquesParaElPanel('', 'promo').find(b => b.id === 'promo'), { id: 'promo', nombre: 'Banda de la campaña', visible: false });
  assert.deepEqual(listaDeTexto(' a, ,b,a '), ['a', 'b']);
});

const curso = (id: string, foto: string | null, extra: Partial<CursoMosaico> = {}): CursoMosaico => ({ id, foto, destacado: false, valoraciones: 0, comprable: true, ...extra });

test('el mosaico: solo cursos con inscripción y foto, sin repetir foto, destacados y más valorados primero', () => {
  const cursos = [
    curso('a', 'f1', { valoraciones: 5 }), curso('b', 'f2', { destacado: true }), curso('c', 'f1', { valoraciones: 900 }),
    curso('d', null, { destacado: true }), curso('e', 'f3', { comprable: false, destacado: true }), curso('f', 'f4', { valoraciones: 50 }),
  ];
  assert.deepEqual(inventarioMosaico(cursos).map(c => c.id), ['b', 'c', 'f']);
  assert.equal(inventarioMosaico(Array.from({ length: 20 }, (_, i) => curso(`x${i}`, `f${i}`))).length, 12);
});

test('el mosaico con cursos elegidos en el panel respeta su orden y descarta los que no valen', () => {
  const cursos = [curso('a', 'f1'), curso('b', 'f2'), curso('c', null), curso('d', 'f1')];
  assert.deepEqual(inventarioMosaico(cursos, ['d', 'c', 'zz', 'b', 'a']).map(c => c.id), ['d', 'b']);
});

test('el reparto entre celdas es por turnos y el primero de cada celda es el que se ve al cargar', () => {
  assert.deepEqual(repartirEnCeldas([1, 2, 3, 4, 5, 6, 7]), [[1, 4, 7], [2, 5], [3, 6]]);
  assert.deepEqual(repartirEnCeldas([1, 2]), [[1], [2]]);
  assert.deepEqual(repartirEnCeldas([]), []);
});
