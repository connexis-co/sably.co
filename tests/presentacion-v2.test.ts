import assert from 'node:assert/strict';
import test from 'node:test';
import { cifra, fotoPropia, iniciales } from '../src/lib/presentacion-v2';

test('solo se usan fotos servidas por Sably', () => {
  assert.equal(fotoPropia('https://sably.co/creadores/mauricio-duque.png'), true);
  assert.equal(fotoPropia('/creadores/x.png'), true);
  assert.equal(fotoPropia('https://hotmart.s3.amazonaws.com/profile_pictures/x/mclafw.png'), false);
  assert.equal(fotoPropia('//evil.example/x.png'), false);
  assert.equal(fotoPropia(undefined), false);
});

test('iniciales del creador', () => {
  assert.equal(iniciales('MasterClasses.La®'), 'MC');
  assert.equal(iniciales('Estefania y Johan'), 'EJ', 'los conectores no cuentan');
  assert.equal(iniciales('Cony Pantoja Montenegro'), 'CP');
  assert.equal(iniciales('Mauricio Duque Zuluaga'), 'MD');
  assert.equal(iniciales('Premium Academy'), 'PA');
});

test('cifras sin símbolo, con los separadores del país', () => {
  assert.equal(cifra(95506, 'es-CO'), '95.506');
  assert.equal(cifra(586.96, 'es-MX'), '586.96');
  assert.equal(cifra(1173.92, 'es-MX'), '1,173.92');
});
