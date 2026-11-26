import assert from 'node:assert/strict';
import test from 'node:test';
import { elegir, extracto, motivoDescarte, leerCsv, MAX_ELEGIDAS } from './hotmart-opiniones.mjs';

test('no se citan precios, quejas de acceso, notas bajas ni textos de relleno', () => {
  assert.match(motivoDescarte('Muy bueno', 5), /corto/);
  assert.match(motivoDescarte('El curso no contiene lo que anuncia, no lo recomiendo', 1), /nota menor/);
  assert.match(motivoDescarte('Muy completo pero por $95.000 pesos esperaba más recetas', 5), /precios/);
  assert.match(motivoDescarte('Me gusta pero no puedo descargar el certificado de ninguna forma', 5), /acceso/);
  assert.match(motivoDescarte('Bien explicado, aunque espero me den respuesta a mis dudas', 5), /respuesta/);
  assert.equal(motivoDescarte('La profesora explica con mucha paciencia y paso a paso cada técnica.', 5), '');
});

test('el extracto es literal y se corta en frase o palabra completa', () => {
  const corto = 'Me encantó la forma de explicar.';
  assert.equal(extracto(corto), corto);
  const largo = `${'Aprendí a preparar la masa desde cero y a decorar con calma. '.repeat(3)}Ahora vendo mis tortas en el barrio y me va muy bien con los pedidos de cada semana.`;
  const e = extracto(largo);
  assert.ok(e.length <= 240);
  assert.ok(largo.startsWith(e.replace(/…$/, '')), 'no cambia el texto, solo lo corta');
  assert.match(e, /[.!?…]$/);
});

test('elige hasta 4, primero las que caben enteras, sin repetir la misma reseña', () => {
  const base = (ucode, texto, nota = 5) => ({ ucode, texto, nota, nombre: 'Ana', fecha: '2024-01-01' });
  const lista = [
    base(1, 'Excelente curso, muy completo.'),
    base(2, 'La maestra explica con mucha paciencia cada paso y se entiende todo muy bien desde el inicio.'),
    base(3, 'La maestra explica con mucha paciencia cada paso y se entiende todo muy bien desde el inicio.'),
    base(4, 'Aprendí técnicas que no conocía y ya las aplico con mis clientas en el salón cada semana.'),
    base(5, 'Muy claro todo, las recetas salen tal cual las muestran en los videos del curso.'),
    base(6, 'Pésimo, no lo recomiendo para nada a nadie que quiera aprender.', 1),
    base(7, 'Los videos tienen buena calidad y el material de apoyo es muy útil para repasar.'),
    base(8, 'Me gustó mucho la forma de enseñar y los ejemplos prácticos de cada módulo.'),
  ];
  const r = elegir(lista);
  const elegidas = r.filter((e) => e.elegida).map((e) => e.ucode);
  assert.equal(elegidas.length, MAX_ELEGIDAS);
  assert.ok(!elegidas.includes(3), 'duplicada');
  assert.ok(!elegidas.includes(6), 'nota baja');
  assert.ok(!elegidas.includes(1), 'la breve queda detrás de las que dicen algo');
});

test('lee CSV con comillas y saltos de línea', () => {
  const filas = leerCsv('curso,producto\n"curso-a","X1"\ncurso-b,"con ""comillas"", y coma"\n');
  assert.deepEqual(filas, [{ curso: 'curso-a', producto: 'X1' }, { curso: 'curso-b', producto: 'con "comillas", y coma' }]);
});
