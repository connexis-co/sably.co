import assert from 'node:assert/strict';
import test from 'node:test';
import { cabeceraOscura, docSably } from '../src/lib/caja/sably';
import { validarCaja, validarBloque } from '../src/lib/caja/validar';
import { resolverZona } from '../src/lib/caja/resolver';
import { PREAJUSTES_FABRICA } from '../src/lib/caja/fabrica';
import { textProblems } from '../src/lib/caja/sitio';

const curso = { courseId: 'curso-de-masajes', escuela: 'masterclasses', cajaElementos: null };

test('el documento de Sably pasa el validador común sin errores', () => {
  const doc = docSably();
  const errores = validarCaja(doc).filter((p) => p.nivel === 'error');
  assert.deepEqual(errores, []);
  assert.equal(doc.sitio, 'cuenta-clara');
  // Lleva todos los de fábrica de la academia (no se pueden borrar) y la Cabecera oscura.
  for (const f of PREAJUSTES_FABRICA) assert.ok(doc.preajustes.some((p) => p.id === f().id), f().id);
  assert.ok(doc.preajustes.some((p) => p.id === 'cabecera-oscura'));
  assert.ok(!JSON.stringify(doc).match(/constancia/i), 'sin «constancia» en los textos de fábrica de Sably');
});

test('«cabecera-oscura» tiene la forma de Preajuste y bloques válidos', () => {
  const p = cabeceraOscura();
  assert.equal(p.id, 'cabecera-oscura');
  assert.equal(p.fabrica, true);
  assert.deepEqual(Object.keys(p.zonas).sort(), ['barra', 'cabeza', 'caja', 'sobre']);
  for (const b of p.zonas.caja) assert.deepEqual(validarBloque(b, 'caja').filter((x) => x.nivel === 'error'), [], b.id);
  const conB = { ...docSably(), sitio: 'cabecera-oscura' };
  assert.deepEqual(validarCaja(conB).filter((x) => x.nivel === 'error'), []);
  assert.equal(resolverZona({ doc: conB, curso, zona: 'caja' }).preajuste, 'cabecera-oscura');
});

test('la caja resuelta de Sably trae los obligatorios en el orden de «Cuenta clara»', () => {
  const z = resolverZona({ doc: docSably(), curso, zona: 'caja' });
  assert.equal(z.preajuste, 'cuenta-clara');
  const tipos = z.bloques.filter((b) => b.visible).map((b) => b.tipo);
  for (const t of ['pais', 'precio', 'boton', 'confianza']) assert.ok(tipos.includes(t as never), t);
  assert.ok(tipos.indexOf('precio') < tipos.indexOf('boton'));
});

test('vocabulario de Sably en el validador', () => {
  assert.ok(textProblems('Con constancia al terminar').length);
  assert.ok(textProblems('Incluye una constancia digital').length);
  assert.ok(textProblems('Te lo vende el productor').length);
  assert.ok(textProblems('El mejor curso del país').length);
  assert.ok(textProblems('Gana dinero desde el primer mes').length);
  assert.ok(textProblems('Apúrate, cupos limitados').length);
  assert.deepEqual(textProblems('Lecciones en vídeo, a tu ritmo y con certificado al terminar.'), []);
  assert.deepEqual(textProblems('Practica con constancia cada semana.'), []);
  assert.deepEqual(textProblems('Electricista con experiencia'), []);
});
