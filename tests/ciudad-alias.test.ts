import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugDeCiudad } from '../src/lib/page-loaders/city-redirect.ts';

test('/mx/ciudad-de-mexico/ se trata como la ciudad cdmx', () => {
  assert.equal(slugDeCiudad('mx', 'ciudad-de-mexico'), 'cdmx');
});

test('las demás ciudades, cursos y países no cambian', () => {
  assert.equal(slugDeCiudad('mx', 'cdmx'), 'cdmx');
  assert.equal(slugDeCiudad('mx', 'curso-de-masajes'), 'curso-de-masajes');
  assert.equal(slugDeCiudad('co', 'ciudad-de-mexico'), 'ciudad-de-mexico');
  assert.equal(slugDeCiudad('mx', undefined), undefined);
});
