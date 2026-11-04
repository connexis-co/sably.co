import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

/* Decisión de negocio: las páginas públicas no enseñan la nota de compradores
   de Hotmart («4,4 (93 valoraciones en Hotmart)»). Si vuelve, que sea a
   propósito y quitando este test, no por arrastrar un componente viejo. */
const archivo = (ruta: string) => new URL(`../${ruta}`, import.meta.url);
const fuente = (ruta: string) => readFileSync(archivo(ruta), 'utf8');

const SIN_NOTA = [
  'src/components/CourseCard.astro',
  'src/components/CourseLanding.astro',
  'src/components/RatingInteractivo.astro',
  'src/components/TrustBar.astro',
  'src/lib/public-stats.ts',
  'src/lib/page-loaders/creator-profile.ts',
  'src/themes/sably-classic/pages/country-home.astro',
  'src/themes/sably-classic/pages/creator-profile.astro',
];

test('las páginas públicas no leen la nota de Hotmart', () => {
  for (const ruta of SIN_NOTA) assert.doesNotMatch(fuente(ruta), /readOperationalRatings?\b/, ruta);
});

test('el componente que pintaba la nota de Hotmart ya no existe', () => {
  assert.equal(existsSync(archivo('src/components/Rating.astro')), false);
});

test('las estrellas de la ficha solo reciben el slug y empiezan vacías', () => {
  const s = fuente('src/components/RatingInteractivo.astro');
  assert.match(s, /interface Props \{\s*slug: string;\s*\}/);
  assert.match(s, />Valora este curso</);
  assert.match(s, /if \(votado\) \{\s*pintar\(votado\);/);
});
