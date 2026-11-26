import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docenteReal, verboImparte } from '../src/lib/docente';

const real = {
  slug: 'roy-el-pinta-carros',
  name: 'Roy El Pinta Carros',
  title: 'Pintor automotriz en ejercicio',
  bio: 'Enseña lo que hace en el taller.',
  credentials: 'Representante oficial de varias marcas.',
  photo: { provider: 'local', id: '01M89K1GK1F917GYQ0JTC4GQDS', src: '/_emdash/api/media/file/01M89K1GJTVQ8SQJ7MPH6Q33ZC.webp' },
  source_url: 'https://royelpintacarros.com/',
  read_at: '2026-11-25',
};

test('un docente con fuente y fecha se pinta, con su foto propia', () => {
  const d = docenteReal(real);
  assert.equal(d?.nombre, 'Roy El Pinta Carros');
  assert.equal(d?.foto, '/_emdash/api/media/file/01M89K1GJTVQ8SQJ7MPH6Q33ZC.webp');
  assert.equal(d?.fuente, 'https://royelpintacarros.com/');
});

test('sin fuente o sin fecha de lectura no hay docente (así eran los inventados)', () => {
  assert.equal(docenteReal({ name: 'Renzo Valdivia', title: 'Cocinero', bio: 'Inventado' }), null);
  assert.equal(docenteReal({ ...real, source_url: '' }), null);
  assert.equal(docenteReal({ ...real, source_url: 'http://inseguro.example/' }), null);
  assert.equal(docenteReal({ ...real, read_at: undefined }), null);
  assert.equal(docenteReal(undefined), null);
});

test('un nombre del lote de relleno nunca se pinta, aunque traiga fuente', () => {
  assert.equal(docenteReal({ ...real, name: 'Adriana Bustamante' }), null);
});

test('la foto de un tercero no se usa: quedan las iniciales', () => {
  assert.equal(docenteReal({ ...real, photo: { provider: 'external', src: 'https://hotmart.s3.amazonaws.com/x.png' } })?.foto, null);
  assert.equal(docenteReal({ ...real, photo: null })?.foto, null);
});

test('sin slug se deriva del nombre', () => {
  assert.equal(docenteReal({ ...real, slug: undefined, name: 'Darío Ortiz' })?.slug, 'dario-ortiz');
});

test('«Imparten» cuando el curso lo dan dos personas', () => {
  assert.equal(verboImparte('Jefferson'), 'Imparte');
  assert.equal(verboImparte('Wilmer Torres y Olga Amaya'), 'Imparten');
  assert.equal(verboImparte('Diana Rojas y Leonardo Ramírez'), 'Imparten');
  assert.equal(verboImparte('Yolanda Amado'), 'Imparte');
});
