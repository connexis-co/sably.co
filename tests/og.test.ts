import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import catalogo from '../src/lib/og-imagenes.json' with { type: 'json' };
import { esFotoAntigua, ogCategoria, ogDeCms, ogEstatica, ogPorPagina } from '../src/lib/og.ts';

test('cada imagen del catálogo existe, mide 1200×630 y pesa menos de 300 KB', async () => {
  for (const i of catalogo.imagenes) {
    const o = ogEstatica(i.id)!;
    const ruta = new URL(`../public${o.url}`, import.meta.url);
    assert.ok(existsSync(ruta), `${o.url} no existe: ejecuta node scripts/og-generar.mjs`);
    const m = await sharp(readFileSync(ruta)).metadata();
    assert.deepEqual([m.width, m.height], [1200, 630], o.url);
    assert.ok(statSync(ruta).size < 300 * 1024, `${o.url} pesa demasiado`);
    assert.ok(o.alt.length > 20, `${i.id} necesita un alt real`);
    assert.match(o.url, /^\/og\/[a-z0-9-]+\.v\d+\.jpg$/);
  }
});

test('hay imagen por país, por categoría y por página principal', () => {
  for (const c of ['co', 'mx', 'pe', 'ec', 'cl', 'ar', 'es', 'us']) assert.ok(ogPorPagina('home', c, `/${c}/`));
  for (const s of ['belleza-online', 'bienestar', 'cuidado-animal', 'emprendimiento', 'gastronomia', 'hospitalidad', 'idiomas', 'manualidades', 'moda-y-confeccion', 'musica', 'oficios', 'panaderia-y-pasteleria']) {
    assert.ok(ogPorPagina('category', 'co', `/co/cursos/${s}/`), s);
    assert.equal(ogCategoria(s).url.includes(`categoria-${s}`), true);
  }
  assert.ok(ogPorPagina('catalog', 'co', '/co/cursos/'));
  assert.ok(ogPorPagina('page', 'co', '/nosotros/'));
  assert.ok(ogPorPagina('page', 'co', '/contacto/'));
  assert.ok(ogPorPagina('page', 'co', '/legal/terminos/'));
  assert.ok(ogPorPagina('blog', 'co', '/blog/'));
  assert.equal(ogPorPagina('page', 'co', '/otra/'), undefined);
  assert.ok(ogCategoria('no-existe').url.includes('/og/sably.'));
});

test('la foto del CMS conserva sus medidas y las antiguas caen en la genérica', () => {
  const nueva = ogDeCms({ provider: 'local', id: '01M89NV1AACSWWZY462BCDQ9AF', width: 1600, height: 1067, mimeType: 'image/jpeg' }, 'Curso')!;
  assert.deepEqual([nueva.ancho, nueva.alto, nueva.tipo, nueva.alt], [1600, 1067, 'image/jpeg', 'Curso']);
  const sinMedidas = ogDeCms({ provider: 'local', id: '01M89NV1AACSWWZY462BCDQ9AF' }, 'Curso')!;
  assert.equal(sinMedidas.ancho, undefined, 'sin medidas guardadas no se inventan');
  assert.equal(ogDeCms({ src: '/_emdash/api/media/file/migration/' + 'a'.repeat(64) + '.jpg' }, 'Curso'), undefined);
  assert.equal(ogDeCms({ provider: 'local', id: '01M', width: 800, height: 536 }, 'Curso'), undefined);
  assert.equal(esFotoAntigua('/x/01M89NV1AACSWWZY462BCDQ9AF.jpg'), false);
  assert.equal(ogDeCms(undefined, 'Curso'), undefined);
});
