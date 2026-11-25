import assert from 'node:assert/strict';
import test from 'node:test';
import { citaSinCortar, nombreLegible, resenasPropias } from '../src/lib/resenas';

const resena = (slug: string, texto: string, nombre = 'Ana') => ({ id: `${slug}-${texto.length}-${nombre}`, slug, nombre, rating: 5, texto, source: 'hotmart-public' as const });

// 24-nov-2026: soldadura y tatuaje enseñaban reseñas de «Reparación de Lavadoras».
test('una ficha solo enseña reseñas de su propio curso', () => {
  const todas = [
    resena('curso-de-reparacion-de-lavadoras', 'Muy bueno, recomiendo a los nuevos alumnos.'),
    resena('curso-de-reparacion-de-lavadoras', 'Excelente explicación.', 'Luis'),
    resena('curso-de-reparacion-de-lavadoras', 'Aprendí a cambiar la bomba.', 'Marta'),
    resena('curso-de-masajes', 'Super interesantes los tips'),
    resena('curso-de-masajes', 'Me gustó mucho.', 'Rosa'),
  ];
  assert.deepEqual(resenasPropias(todas, 'curso-de-soldadura'), []);
  assert.deepEqual(resenasPropias(todas, 'curso-de-reparacion-de-lavadoras').map((r) => r.slug), Array(3).fill('curso-de-reparacion-de-lavadoras'));
});

test('con menos de tres reseñas propias la sección no se pinta', () => {
  const dos = [resena('curso-de-masajes', 'Super interesantes los tips'), resena('curso-de-masajes', 'Me gustó mucho.', 'Rosa')];
  assert.deepEqual(resenasPropias(dos, 'curso-de-masajes'), []);
  const tres = [...dos, resena('curso-de-masajes', 'Clases claras.', 'Eva')];
  assert.equal(resenasPropias(tres, 'curso-de-masajes').length, 3);
  // Las que no traen texto o no son reseñas públicas de Hotmart no cuentan.
  assert.deepEqual(resenasPropias([...dos, resena('curso-de-masajes', '   ', 'Eva')], 'curso-de-masajes'), []);
  assert.deepEqual(resenasPropias([...dos, { ...resena('curso-de-masajes', 'Bien.', 'Eva'), source: 'verified-purchase' }], 'curso-de-masajes'), []);
  assert.equal(resenasPropias(Array.from({ length: 9 }, (_, i) => resena('curso-de-masajes', `Reseña ${i}.`, `P${i}`)), 'curso-de-masajes').length, 6);
});

test('una cita cortada por la captura no termina a media palabra', () => {
  // Como en la captura real: 120 caracteres justos, la última palabra a medias.
  const entera = 'Me pareció un curso muy completo y bien explicado, aprendí bastante sobre las técnicas y me gustaron mucho las formas diferentes de explicar';
  const cortada = entera.slice(0, 120);
  assert.match(cortada, /\S$/);
  assert.match(entera.slice(120, 121), /\S/, 'el corte cae en mitad de una palabra');
  const cita = citaSinCortar(cortada);
  assert.equal(cita, `${cortada.slice(0, cortada.lastIndexOf(' '))}…`);
  assert.ok(entera.startsWith(cita.slice(0, -1)) && entera[cita.length - 1] === ' ', 'termina en una palabra entera');

  // Con una frase completa antes del corte, se queda en ella.
  const conFrase = `Excelente curso, muy claras sus clases y el material de apoyo es bueno. Lo recomiendo ${'muchísimo'.repeat(10)}`.slice(0, 120);
  assert.match(conFrase, /\S$/);
  assert.equal(citaSinCortar(conFrase), 'Excelente curso, muy claras sus clases y el material de apoyo es bueno.');

  // Una reseña entera, corta o sin punto final, no se toca.
  assert.equal(citaSinCortar('Super interesantes los tips'), 'Super interesantes los tips');
  assert.equal(citaSinCortar('  Todo muy   profesional '), 'Todo muy profesional');
});

test('el nombre en mayúsculas se escribe como nombre', () => {
  assert.equal(nombreLegible('MARCOS'), 'Marcos');
  assert.equal(nombreLegible('JUAN CARLOS'), 'Juan Carlos');
  assert.equal(nombreLegible('María José'), 'María José');
  assert.equal(nombreLegible('J'), 'J');
});
