import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { FOTOS_PESTANA, fotoDePestana } from '../src/themes/sably-v2/fotos';

const CARPETA = 'public/v2/fotos/curso';
const archivos = (slug: string, pestana: string) =>
  [480, 960].flatMap(w => ['avif', 'webp'].map(f => `${slug}-${pestana}-${w}.${f}`));
const declaradas = Object.entries(FOTOS_PESTANA).flatMap(([slug, p]) => Object.entries(p).map(([pestana, alt]) => ({ slug, pestana, alt })));

test('cada foto de pestaña declarada tiene sus cuatro archivos y un alt', () => {
  for (const { slug, pestana, alt } of declaradas) {
    assert.ok(alt && alt.length > 20, `alt de ${slug} ${pestana}`);
    for (const archivo of archivos(slug, pestana)) assert.ok(existsSync(`${CARPETA}/${archivo}`), archivo);
  }
});

test('no hay archivos en la carpeta que ningún curso use', () => {
  const usados = new Set(declaradas.flatMap(d => archivos(d.slug, d.pestana)));
  const sobran = existsSync(CARPETA) ? readdirSync(CARPETA).filter(a => !usados.has(a)) : [];
  assert.deepEqual(sobran, []);
});

test('un curso sin fotos propias, o una pestaña sin ella, cae en las genéricas', () => {
  assert.equal(fotoDePestana('curso-que-no-existe', 'necesitas'), null);
  assert.equal(fotoDePestana('curso-de-barberia', 'para-quien'), null);
});
