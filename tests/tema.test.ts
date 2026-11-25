import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarTema, resolverTema, temaPorDefecto } from '../src/lib/tema';
import { leerAjustesV2, rellenarPlantilla } from '../src/lib/ajustes-tema';
import { canCachePublicPage, invalidatedTags, sharedPublicRequest } from '../src/lib/public-delivery';

test('V2 nace apagado: sin ajuste ni variable, el tema es el clásico', () => {
  assert.equal(temaPorDefecto(undefined, undefined), 'clasico');
  assert.equal(temaPorDefecto('', ''), 'clasico');
  assert.equal(temaPorDefecto('otro', 'nada'), 'clasico');
});

test('el ajuste del panel gana a la variable de entorno', () => {
  assert.equal(temaPorDefecto('v2', 'clasico'), 'v2');
  assert.equal(temaPorDefecto('clasico', 'v2'), 'clasico');
  assert.equal(temaPorDefecto(undefined, 'v2'), 'v2');
  assert.equal(temaPorDefecto(null, 'V2'), 'v2');
});

test('?tema= fuerza el tema y lo marca como forzado', () => {
  assert.deepEqual(resolverTema(new URL('https://sably.co/co/curso-de-masajes/?tema=v2'), 'clasico'), { tema: 'v2', forzado: true });
  assert.deepEqual(resolverTema(new URL('https://sably.co/co/curso-de-masajes/?tema=clásico'), 'v2'), { tema: 'clasico', forzado: true });
  assert.deepEqual(resolverTema(new URL('https://sably.co/co/curso-de-masajes/'), 'v2'), { tema: 'v2', forzado: false });
  // Un valor desconocido no fuerza nada.
  assert.deepEqual(resolverTema(new URL('https://sably.co/co/curso-de-masajes/?tema=rojo'), 'clasico'), { tema: 'clasico', forzado: false });
  assert.equal(normalizarTema('Classic'), 'clasico');
});

test('una página con ?tema= nunca entra en la caché compartida', () => {
  const forzada = new Request('https://sably.co/co/curso-de-masajes/?tema=v2');
  assert.equal(canCachePublicPage(forzada, 'production'), false);
  assert.equal(sharedPublicRequest(forzada, 'production'), null);
  // La misma URL sin el parámetro sí es cacheable: la clave nunca se mezcla.
  assert.equal(canCachePublicPage(new Request('https://sably.co/co/curso-de-masajes/'), 'production'), true);
});

test('guardar los ajustes del plugin invalida las páginas', () => {
  const ok = new Response('{}', { status: 200 });
  for (const path of ['/_emdash/api/admin/plugins/sably-operations/settings', '/_emdash/api/plugins/sably-operations/save-promo']) {
    assert.deepEqual(invalidatedTags(new Request(`https://sably.co${path}`, { method: 'POST' }), ok), ['sably:public']);
  }
  assert.deepEqual(invalidatedTags(new Request('https://sably.co/_emdash/api/admin/plugins/otro/settings', { method: 'POST' }), ok), []);
});

test('ajustes del panel con sus valores por defecto', () => {
  const vacios = leerAjustesV2([]);
  assert.equal(vacios.temaPorDefecto, 'clasico');
  assert.equal(vacios.caja.variante, 'cuenta-clara');
  assert.equal(vacios.caja.contador, 'barra');
  assert.equal(vacios.mostrarCreador, true);
  assert.equal(vacios.estiloCampo, 'outlined');
  const filas = [
    { name: 'plugin:sably-operations:settings:temaPorDefecto', value: '"v2"' },
    { name: 'plugin:sably-operations:settings:cajaVariante', value: '"cabecera-oscura"' },
    { name: 'plugin:sably-operations:settings:cajaContador', value: '"inventado"' },
    { name: 'plugin:sably-operations:settings:mostrarCreador', value: 'false' },
    { name: 'plugin:sably-operations:settings:cajaTitulo', value: '""' },
    { name: 'plugin:otro:settings:temaPorDefecto', value: '"clasico"' },
  ];
  const a = leerAjustesV2(filas, 'clasico');
  assert.equal(a.temaPorDefecto, 'v2');
  assert.equal(a.caja.variante, 'cabecera-oscura');
  assert.equal(a.caja.contador, 'barra', 'un valor fuera de la lista vuelve al de por defecto');
  assert.equal(a.mostrarCreador, false);
  assert.equal(a.caja.titulo, '', 'el título vacío apaga el título de la caja');
});

test('plantillas de título y subtítulo', () => {
  assert.equal(rellenarPlantilla('Empieza {curso}', { curso: 'el Curso de masajes' }), 'Empieza el Curso de masajes');
  assert.equal(rellenarPlantilla('{lecciones} lecciones, {horas} horas.', { lecciones: 28, horas: 20 }), '28 lecciones, 20 horas.');
  assert.equal(rellenarPlantilla('Curso {desconocida}.', {}), 'Curso.');
});
