import assert from 'node:assert/strict';
import test from 'node:test';
import { leerLista, limpiarEntrada, limpiarTexto, nombreEnMdx, quitarDeFrase, sinBloqueInstructor } from './instructores-relleno.mjs';

const N = 'Andrés Villamil';
const quitar = (frase) => quitarDeFrase(frase, N);

// Frases tomadas de las variantes de país del repositorio (24-nov-2026), con el nombre cambiado.
test('con el rol delante, se va el nombre y se queda el rol', () => {
  assert.deepEqual(quitar('¿La instructora Andrés Villamil evalúa los trajes de baño que confeccione?'), { texto: '¿La instructora evalúa los trajes de baño que confeccione?', regla: 'rol' });
  assert.equal(quitar('Puedes dejar tus preguntas para que el equipo o el instructor Andrés Villamil respondan tus inquietudes.').texto, 'Puedes dejar tus preguntas para que el equipo o el instructor respondan tus inquietudes.');
});

test('el complemento con el nombre se cae y la frase sigue entera', () => {
  assert.equal(quitar('A lo largo de las 11 horas de contenido impartidas por Andrés Villamil, vas a ir desde la teoría hasta la práctica.').texto, 'A lo largo de las 11 horas de contenido, vas a ir desde la teoría hasta la práctica.');
  assert.equal(quitar('Bajo la guía de Andrés Villamil, vas a identificar cómo trabaja el diafragma.').texto, 'Vas a identificar cómo trabaja el diafragma.');
  assert.equal(quitar('Acredita las 14 horas de capacitación técnica con Andrés Villamil.').texto, 'Acredita las 14 horas de capacitación técnica.');
  assert.equal(quitar('¿Qué pasa si tengo dudas sobre el material dictado por Andrés Villamil?').texto, '¿Qué pasa si tengo dudas sobre el material?');
  assert.equal(quitar('Si sientes que el método de Andrés Villamil no se ajusta a lo que buscabas, puedes pedir el reembolso en Hotmart.').texto, 'Si sientes que el método no se ajusta a lo que buscabas, puedes pedir el reembolso en Hotmart.');
  assert.equal(quitar('Obtendrás un certificado digital avalado por Andrés Villamil, que acredita tu formación.').texto, 'Obtendrás un certificado digital, que acredita tu formación.');
});

test('como sujeto, el nombre pasa a ser «el curso»', () => {
  assert.deepEqual(quitar('Andrés Villamil explica cada maniobra paso a paso.'), { texto: 'El curso explica cada maniobra paso a paso.', regla: 'sujeto' });
  assert.equal(quitar('En 16 lecciones, Andrés Villamil te guía por las fases del masaje.').texto, 'En 16 lecciones, el curso te guía por las fases del masaje.');
  assert.equal(quitar('¿Andrés Villamil realiza correcciones personalizadas?').texto, '¿El curso realiza correcciones personalizadas?');
});

test('si la frase habla de la persona, se quita entera: su biografía también es inventada', () => {
  for (const frase of [
    'El curso es impartido por Andrés Villamil, quien guía cada lección paso a paso.',
    'Las clases son impartidas por Andrés Villamil, especialista con amplia trayectoria en el sector.',
    'Bajo la tutoría de Andrés Villamil, diseñadora con experiencia en el sector, adquirirás las competencias.',
    'La formación está a cargo de Andrés Villamil.',
    'Tu instructor: Andrés Villamil',
    'Empieza hoy con Andrés Villamil.',
  ]) assert.deepEqual(quitar(frase), { texto: '', regla: 'frase' }, frase);
});

test('un texto largo conserva su estructura: encabezados, viñetas y párrafos', () => {
  const md = '## Cómo avanzar a tu ritmo con Andrés Villamil\n\nAndrés Villamil te guía en 14 lecciones. El curso es impartido por Andrés Villamil, quien tiene 11 años de experiencia. Practicas en casa.\n\n- Lecciones grabadas por Andrés Villamil\n- Acceso de por vida';
  const { texto, cambios } = limpiarTexto(md, [N, 'Isabel Munévar']);
  // La viñeta «Lecciones grabadas por…» se queda en una palabra y desaparece con su marca.
  assert.equal(texto, '## Cómo avanzar a tu ritmo\n\nEl curso te guía en 14 lecciones. Practicas en casa.\n\n- Acceso de por vida');
  assert.equal(cambios.length, 4);
  assert.doesNotMatch(texto, /Villamil/);
  // Un texto sin nombres vuelve idéntico, sin normalizar nada.
  assert.equal(limpiarTexto('  Texto   con espacios.\n\n\nOtro párrafo. ', [N]).texto, '  Texto   con espacios.\n\n\nOtro párrafo. ');
});

test('una variante de país queda sin nombres; la pregunta que no se puede salvar se elimina', () => {
  const variante = {
    course: 'curso-de-masajes', country: 'co',
    subtitulo: 'Aprende masajes de la mano de Andrés Villamil y emprende.',
    beneficios: ['Aprender maniobras seguras', 'Seguir el método de Andrés Villamil sin lastimar'],
    faqs: [
      { q: '¿Quién imparte el curso?', a: 'El curso es impartido por Andrés Villamil, quien trabaja en spa desde hace 11 años.' },
      { q: '¿Puedo resolver dudas con Andrés Villamil?', a: 'Sí, en el área de preguntas del curso.' },
    ],
    _meta: { modelo: 'gemini', nota: 'Andrés Villamil' },
  };
  const { datos, cambios } = limpiarEntrada(variante, [N]);
  assert.equal(datos.subtitulo, 'Aprende masajes y emprende.');
  assert.deepEqual(datos.beneficios, ['Aprender maniobras seguras', 'Seguir el método sin lastimar']);
  assert.deepEqual(datos.faqs, [{ q: '¿Puedo resolver dudas?', a: 'Sí, en el área de preguntas del curso.' }]);
  assert.equal(datos._meta.nota, 'Andrés Villamil', 'los metadatos internos no son contenido');
  assert.deepEqual(cambios.map((c) => c.regla).sort(), ['agente', 'agente', 'agente', 'faq-eliminada', 'frase']);
  const { _meta, ...publico } = datos;
  assert.doesNotMatch(JSON.stringify(publico), /Villamil/);
});

test('el bloque instructor de relleno sale del MDX; el del creador real se queda', () => {
  const mdx = (nombre) => `---\ntitle: Curso de Masajes\ninstructor:\n  name: ${nombre}\n  title: Masoterapeuta\n  bio: Trabaja en spa desde hace 11 años.\nlearnings:\n  - Maniobras\n---\n\nCuerpo.\n`;
  assert.equal(nombreEnMdx(mdx(N)), N);
  assert.equal(sinBloqueInstructor(mdx(N)), '---\ntitle: Curso de Masajes\nlearnings:\n  - Maniobras\n---\n\nCuerpo.\n');
  const real = mdx('MasterClasses.La · Seminarios Online');
  assert.equal(sinBloqueInstructor(real), real);
});

test('la lista publicada tiene los 106 nombres y ningún creador real', () => {
  const lista = leerLista();
  assert.equal(lista.length, 106);
  assert.equal(new Set(lista).size, 106);
  assert(!lista.some((n) => /masterclasses|seminarios/i.test(n)));
});
