import assert from 'node:assert/strict';
import test from 'node:test';
import { auditarOnPage, encabezados } from './seo-onpage.mjs';

const url = 'https://sably.co/co/curso-de-masajes/';
const pagina = (cuerpo, cabeza = '') => `<!doctype html><html lang="es"><head><title>Curso de masajes en Colombia | Sably</title>
<meta name="description" content="Aprende masajes desde cero con clases en video, a tu ritmo y desde el celular. Temario, precio y garantía en la ficha.">
<meta property="og:image" content="https://sably.co/og.jpg">${cabeza}</head><body>${cuerpo}</body></html>`;
const sana = pagina(`<header><nav><p>Programas de estudio</p></nav></header>
<main><h1>Curso de masajes para emprender</h1><h2>Qué aprenderás en el Curso de Masajes</h2><h3>Técnica</h3><h2>Temario del Curso de Masajes</h2>
<img src="/a.jpg" alt="Curso de Masajes" width="480" height="320"></main><footer><p>Categorías</p></footer>
<script type="application/ld+json">{"@type":["Product","Course"],"name":"Curso de Masajes"}</script>`);
const errores = (html) => auditarOnPage(url, html).filter((h) => h.nivel === 'error').map((h) => h.regla);

test('una ficha bien construida no deja errores', () => {
  assert.deepEqual(errores(sana), []);
  assert.deepEqual(encabezados(sana).map((h) => h.nivel), [1, 2, 3, 2]);
});

test('los rótulos del menú no pueden ser encabezados antes del H1', () => {
  assert.deepEqual(errores(sana.replace('<p>Programas de estudio</p>', '<h2>Programas de estudio</h2>')), ['h1-primero']);
});

test('detecta H1 repetido o ausente, saltos de nivel y encabezados vacíos', () => {
  assert.deepEqual(errores(sana.replace('<h3>Técnica</h3>', '<h1>Otro</h1>')), ['h1-unico']);
  assert(errores(sana.replace(/<h1>[^<]+<\/h1>/, '')).includes('h1-unico'));
  assert.deepEqual(errores(sana.replace('<h3>Técnica</h3>', '<h4>Técnica</h4>')), ['sin-saltos']);
  assert.deepEqual(errores(sana.replace('<h3>Técnica</h3>', '<h3> </h3>')), ['encabezado-vacio']);
});

test('los encabezados dentro de script, style, template o comentarios no cuentan', () => {
  assert.deepEqual(errores(sana.replace('</main>', '<script>const x="<h1>no</h1>"</script><!-- <h1>no</h1> --><template><h5>no</h5></template></main>')), []);
});

test('detecta imágenes sin alt, marcado roto y nodos que se retiraron', () => {
  assert.deepEqual(errores(sana.replace(' alt="Curso de Masajes"', '')), ['img-alt']);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"}', '')), ['json-ld']);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"', '"instructor":{"@type":"Person","name":"X"}')), ['json-ld-person']);
  assert.deepEqual(errores(sana.replace('"name":"Curso de Masajes"', '"aggregateRating":{"@type":"AggregateRating"}')), ['json-ld-rating']);
});

test('los textos retirados por no ser ciertos no pueden volver', () => {
  for (const frase of ['<h2>Tu instructor</h2>', '<p>Enlace de afiliado</p>', '<p>¡Espera! Tu cupo sigue disponible</p>', '<p>50% solo hoy</p>'])
    assert(errores(sana.replace('</main>', `${frase}</main>`)).includes('texto-vetado'), frase);
});

test('título, descripción y lang ausentes son errores; las longitudes, avisos', () => {
  assert(errores(sana.replace(/<title>[^<]+<\/title>/, '')).includes('titulo'));
  assert(errores(sana.replace(/<meta name="description"[^>]+>/, '')).includes('descripcion'));
  assert(errores(sana.replace(' lang="es"', '')).includes('lang'));
  const avisos = auditarOnPage(url, sana.replace('Curso de masajes en Colombia | Sably', 'x'.repeat(80))).filter((h) => h.nivel === 'aviso').map((h) => h.regla);
  assert.deepEqual(avisos, ['titulo-largo']);
});
