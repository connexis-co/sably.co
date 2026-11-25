/**
 * Enlaces a webs propias escritos en el CMS (texto rico y botones de tarjetas) salen con `nofollow`.
 * El 25-nov /nosotros/ seguía enlazando follow a academiadebelleza.edu.co y cursodeglobosonline.com desde el
 * texto del panel, aunque la cabecera y el pie ya estaban arreglados (#235). La prueba de la página servida es la
 * regla `red-propia-follow` de scripts/seo-onpage.mjs; esta vigila que el cableado no se pierda.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relDe, esWebPropia } from '../src/lib/enlaces-propios';

const fuente = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

test('el texto rico del CMS usa la marca de enlace propia', () => {
  assert.match(fuente('src/components/CmsRichBody.astro'), /mark:\s*\{\s*link:\s*CmsEnlace\s*\}/);
  const enlace = fuente('src/components/CmsEnlace.astro');
  assert.match(enlace, /esWebPropia\(href\)/);
  assert.match(enlace, /rel=\{blank \? 'noopener noreferrer nofollow' : 'nofollow'\}/);
  assert.match(enlace, /<Link node=\{node\}>/, 'los demás enlaces siguen con la marca de EmDash (saneado incluido)');
});

test('los botones de tarjetas (V2 y clásico) calculan rel con relDe', () => {
  assert.match(fuente('src/themes/sably-v2/components/bloques/Tarjetas.astro'), /rel=\{relDe\(href\)\}/);
  assert.match(fuente('src/themes/sably-classic/components/blocks/Cards.astro'), /rel=\{relDe\(safeEditorialUrl\(card\.button_url\)!\)\}/);
});

test('los enlaces de /nosotros/ que fallaban son webs propias y salen nofollow', () => {
  for (const href of ['https://academiadebelleza.edu.co', 'https://cursodeglobosonline.com']) {
    assert.equal(esWebPropia(href), true);
    assert.equal(relDe(href), 'noopener nofollow');
  }
  assert.equal(esWebPropia('/co/cursos/oficios/'), false);
  assert.equal(relDe('/co/cursos/oficios/'), undefined);
});
