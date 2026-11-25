import assert from 'node:assert/strict';
import test from 'node:test';
import { conConstancia } from '../src/lib/vocabulario';

// Fórmulas reales de las descripciones cortas (24-nov-2026): 57 terminan en «Certificado incluido.».
test('las fórmulas del documento del curso pasan a «constancia» con su concordancia', () => {
  assert.equal(conConstancia('Curso de velas artesanales para vender. Certificado incluido.'), 'Curso de velas artesanales para vender. Constancia incluida.');
  assert.equal(conConstancia('Sin experiencia previa, certificado incluido.'), 'Sin experiencia previa, constancia incluida.');
  assert.equal(conConstancia('Certificado digital incluido.'), 'Constancia digital incluida.');
  assert.equal(conConstancia('Incluye certificado digital y un plan para montar tu barbería.'), 'Incluye constancia digital y un plan para montar tu barbería.');
  assert.equal(conConstancia('…desde casa, obtén tu certificado digital y cobra más.'), '…desde casa, obtén tu constancia digital y cobra más.');
  assert.equal(conConstancia('Aprende electricidad residencial desde cero y obtén tu certificado.'), 'Aprende electricidad residencial desde cero y obtén tu constancia.');
  assert.equal(conConstancia('…maquillaje social, de día y de noche, con certificado.'), '…maquillaje social, de día y de noche, con constancia.');
  assert.equal(conConstancia('Aprende a tatuar. Certificado y garantía de 7 días.'), 'Aprende a tatuar. Constancia y garantía de 7 días.');
  assert.equal(conConstancia('Certificado y garantía de 7 días incluidos.'), 'Constancia y garantía de 7 días incluidas.');
});

test('donde «certificado» es otra cosa, no se toca', () => {
  for (const texto of [
    'Trabaja como electricista certificado en obras residenciales.',
    'Aprende RCP y certifícate para responder en cualquier emergencia.',
    'Homologación de saberes: certificación de experiencia con instituciones ETDH aliadas.',
    'Con certificado de aptitud ocupacional de la institución aliada.',
    'Curso de masajes desde cero, con práctica guiada.',
  ]) assert.equal(conConstancia(texto), texto);
});
