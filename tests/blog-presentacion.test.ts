import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cabeceraElegida, presentacionDeArticulo, OPCIONES_CABECERA } from '../src/lib/blog-presentacion';
import { CAMPOS_BLOG } from '../scripts/blog-campos-articulo.mjs';

const base = { panel: 'automatica', propia: undefined, conPortada: true, conVideo: false, conNarracion: false, conIndice: true } as const;

test('presentación por artículo: el texto de la opción del editor da la letra; lo demás es heredar', () => {
  assert.deepEqual(presentacionDeArticulo({ cabecera: 'E · Editorial, titular grande' }), { cabecera: 'e' });
  assert.deepEqual(presentacionDeArticulo({ cabecera: 'Heredar del panel' }), {});
  assert.deepEqual(presentacionDeArticulo({ cabecera: 'I · Autor destacado' }), {});
  assert.deepEqual(presentacionDeArticulo({ cabecera: 42 }), {});
  assert.deepEqual(presentacionDeArticulo({}), {});
  for (const opcion of OPCIONES_CABECERA.slice(1)) assert.ok(presentacionDeArticulo({ cabecera: opcion }).cabecera, opcion);
});

test('el campo del CMS ofrece las mismas opciones que entiende el sitio', () => {
  const campo = CAMPOS_BLOG.find(c => c.slug === 'cabecera');
  assert.deepEqual(campo?.validation.options, OPCIONES_CABECERA);
});

test('cabecera elegida: automática, la del artículo manda y nunca se inventa lo que falta', () => {
  assert.equal(cabeceraElegida(base), 'b');
  assert.equal(cabeceraElegida({ ...base, conPortada: false }), 'd');
  assert.equal(cabeceraElegida({ ...base, panel: 'e' }), 'e');
  assert.equal(cabeceraElegida({ ...base, panel: 'e', propia: 'h' }), 'h');
  assert.equal(cabeceraElegida({ ...base, panel: 'e', conPortada: false }), 'd');
  assert.equal(cabeceraElegida({ ...base, panel: 'h', conPortada: false }), 'h');
  assert.equal(cabeceraElegida({ ...base, panel: 'f' }), 'b');
  assert.equal(cabeceraElegida({ ...base, panel: 'f', conVideo: true }), 'f');
  assert.equal(cabeceraElegida({ ...base, panel: 'g' }), 'b');
  assert.equal(cabeceraElegida({ ...base, panel: 'g', conNarracion: true, conPortada: false }), 'g');
  assert.equal(cabeceraElegida({ ...base, panel: 'j', conIndice: false }), 'b');
  assert.equal(cabeceraElegida({ ...base, panel: 'j' }), 'j');
  assert.equal(cabeceraElegida({ ...base, panel: 'z' }), 'b');
});

test('campos por artículo: índice, publicidad, curso relacionado y «actualizado el»; vacío o desconocido = heredar', () => {
  assert.deepEqual(presentacionDeArticulo({ indice: 'Heredar del panel', publicidad: 'Heredar del panel', curso_relacionado: '', actualizado_el: null }), {});
  const p = presentacionDeArticulo({ indice: 'Al inicio', publicidad: 'Ninguna en este artículo', curso_relacionado: 'https://sably.co/co/curso-de-modisteria/?x=1', actualizado_el: '2026-11-20T00:00:00.000Z' });
  assert.equal(p.indice, 'inicio');
  assert.equal(p.publicidad, 'ninguna');
  assert.equal(p.cursoRelacionado, 'curso-de-modisteria');
  assert.equal(p.actualizadoEl?.toISOString(), '2026-11-20T00:00:00.000Z');
  assert.equal(presentacionDeArticulo({ indice: 'Lateral' }).indice, 'lateral');
  assert.equal(presentacionDeArticulo({ indice: 'Ninguno' }).indice, 'ninguno');
  assert.equal(presentacionDeArticulo({ curso_relacionado: '<script>' }).cursoRelacionado, undefined);
  assert.equal(presentacionDeArticulo({ actualizado_el: 'no es fecha' }).actualizadoEl, undefined);
  for (const slug of ['indice', 'publicidad', 'curso_relacionado', 'actualizado_el']) assert.ok(CAMPOS_BLOG.some(c => c.slug === slug), slug);
});
