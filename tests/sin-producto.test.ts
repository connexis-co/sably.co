import assert from 'node:assert/strict';
import test from 'node:test';
import { sinPromesas } from '../src/lib/sin-producto';

// 24-nov-2026: /co/curso-de-tatuaje/ no se puede comprar y su subtítulo prometía
// «Certificado y garantía de 7 días».
test('un curso sin producto no promete certificado, garantía ni acceso', () => {
  assert.equal(sinPromesas('Aprende a tatuar desde cero con práctica guiada. Certificado y garantía de 7 días.'), 'Aprende a tatuar desde cero con práctica guiada.');
  assert.equal(
    sinPromesas('Curso de aire acondicionado para instalar, limpiar y reparar equipos split. Certificado incluido.'),
    'Curso de aire acondicionado para instalar, limpiar y reparar equipos split.',
  );
  assert.equal(sinPromesas('Acceso de por vida y garantía de 7 días.'), '');
  assert.equal(sinPromesas('Inscríbete hoy. Pago seguro en Hotmart.'), '');
});

test('si la promesa es un inciso, se conserva el resto de la frase', () => {
  assert.equal(
    sinPromesas('Aprende electricidad residencial desde cero y obtén tu certificado. Instalaciones, tableros y reparaciones seguras.'),
    'Aprende electricidad residencial desde cero. Instalaciones, tableros y reparaciones seguras.',
  );
  assert.equal(
    sinPromesas('Domina la parrilla, los cortes y los términos de la carne, con certificado incluido.'),
    'Domina la parrilla, los cortes y los términos de la carne.',
  );
});

test('un texto sin promesas no cambia', () => {
  const texto = 'Aprende bartending y coctelería profesional desde casa. Técnicas de bar, cócteles clásicos y de autor.';
  assert.equal(sinPromesas(texto), texto);
});
