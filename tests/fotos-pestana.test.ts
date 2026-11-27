import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { FOTOS, FOTOS_MAS_SOBRE, FOTOS_PESTANA, fotoDeCurso, fotoDePestana, fotoMasSobre } from '../src/themes/sably-v2/fotos';

const CARPETA = 'public/v2/fotos/curso';
/* Los nombres salen de lo que la ficha pide (incluida la versión del archivo). */
const archivos = (slug: string, pestana: string) => {
  const foto = fotoDePestana(slug, pestana)!;
  return [foto.avif, foto.webp].flatMap(juego => juego.split(', ').map(v => v.split(' ')[0]!.replace('/v2/fotos/curso/', '')));
};
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

test('«Más sobre el curso»: cada variante tiene sus archivos y el reparto por curso es estable', () => {
  for (const nombre of FOTOS_MAS_SOBRE) {
    assert.ok(FOTOS[nombre].alt.length > 20, nombre);
    for (const w of [480, 960]) for (const f of ['avif', 'webp']) assert.ok(existsSync(`public/v2/fotos/${nombre}-${w}.${f}`), `${nombre}-${w}.${f}`);
  }
  const slugs = Object.keys(FOTOS_PESTANA);
  for (const slug of slugs) assert.equal(fotoMasSobre(slug), fotoMasSobre(slug));
  assert.equal(new Set(slugs.map(fotoMasSobre)).size, FOTOS_MAS_SOBRE.length, 'las tres variantes salen en el catálogo');
});

test('cada curso de velas, jabones, cejas y pestañas recibe la foto de su oficio, con sus archivos', () => {
  const casos = [
    ['curso-de-velas-artesanales-y-aromaticas', 'foto-velas-2'],
    ['curso-de-jabones-artesanales', 'foto-velas-1'],
    ['curso-de-diseno-de-cejas-con-hilo-y-henna', 'foto-cejas-1'],
    ['curso-de-cejas-y-pestanas', 'foto-pestanas-1'],
    ['curso-de-pestanas-volumen-ruso', 'foto-pestanas-1'],
  ] as const;
  for (const [slug, nombre] of casos) {
    assert.equal(fotoDeCurso(slug, ''), nombre, slug);
    for (const w of [480, 960]) for (const f of ['avif', 'webp']) assert.ok(existsSync(`public/v2/fotos/${nombre}-${w}.${f}`), `${nombre}-${w}.${f}`);
  }
});
