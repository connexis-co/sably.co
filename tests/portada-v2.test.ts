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

test('el mosaico con la lista de fábrica se completa con el orden automático sin repetir foto', () => {
  const cursos = [curso('a', 'f1', { destacado: true }), curso('b', 'f2'), curso('c', 'f3', { valoraciones: 9 }), curso('d', 'f2', { valoraciones: 99 })];
  assert.deepEqual(inventarioMosaico(cursos, ['b', 'zz'], 12, true).map(c => c.id), ['b', 'a', 'c']);
});

test('el reparto entre celdas es por turnos y el primero de cada celda es el que se ve al cargar', () => {
  assert.deepEqual(repartirEnCeldas([1, 2, 3, 4, 5, 6, 7]), [[1, 4, 7], [2, 5], [3, 6]]);
  assert.deepEqual(repartirEnCeldas([1, 2]), [[1], [2]]);
  assert.deepEqual(repartirEnCeldas([]), []);
});

test('los mejor valorados: umbral de valoraciones, orden por nota y por número, y nada si no llegan a tres', async () => {
  const { mejorValorados } = await import('../src/themes/sably-v2/portada.ts');
  const c = (id: string, comprable = true) => ({ id, comprable });
  const notas = { a: { rating: 4.9, total: 25 }, b: { rating: 4.9, total: 300 }, c: { rating: 5, total: 19 }, d: { rating: 4.1, total: 80 }, e: { rating: 4.95, total: 40 }, f: { rating: 6, total: 99 } };
  assert.deepEqual(mejorValorados([c('a'), c('b'), c('c'), c('d'), c('e', false), c('f')], notas).map(x => x.id), ['b', 'a', 'd']);
  assert.deepEqual(mejorValorados([c('a'), c('b'), c('c')], notas), []);
  assert.deepEqual(mejorValorados([c('a'), c('b'), c('c'), c('d')], notas, 10, 2, 2).map(x => x.id), ['c', 'b']);
});

test('las sugerencias del buscador de la portada: mismos criterios que el de la cabecera', async () => {
  const { buscarEnIndice } = await import('../src/themes/sably-v2/buscar-sugerencias.ts');
  const indice = [
    { t: 'Curso de Masajes', s: 'curso-de-masajes', c: 'Bienestar', k: 'relajante espalda' },
    { t: 'Curso de Barbería', s: 'curso-de-barberia', c: 'Belleza', k: 'masa muscular no' },
    { t: 'Drenaje linfático', s: 'curso-de-drenaje', c: 'Bienestar', k: 'masaje' },
  ];
  assert.deepEqual(buscarEnIndice(indice, 'masa').map(r => r.s), ['curso-de-masajes', 'curso-de-barberia', 'curso-de-drenaje']);
  assert.deepEqual(buscarEnIndice(indice, 'BARBERIA').map(r => r.s), ['curso-de-barberia']);
  assert.deepEqual(buscarEnIndice(indice, 'm'), []);
  assert.deepEqual(buscarEnIndice(indice, 'masaje bienestar').map(r => r.s), ['curso-de-masajes', 'curso-de-drenaje']);
});
