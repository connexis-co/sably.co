import assert from 'node:assert/strict';
import test from 'node:test';
import { conConstancia } from '../src/lib/vocabulario';

// 26-nov-2026: JP decide «certificado». Las fórmulas de «constancia» que dejó la regla
// anterior vuelven a «certificado» con su concordancia.
test('las fórmulas del documento del curso pasan a «certificado» con su concordancia', () => {
  assert.equal(conConstancia('Curso de velas artesanales para vender. Constancia incluida.'), 'Curso de velas artesanales para vender. Certificado incluido.');
  assert.equal(conConstancia('Constancia digital incluida.'), 'Certificado digital incluido.');
  assert.equal(conConstancia('Incluye constancia digital y un plan para montar tu barbería.'), 'Incluye certificado digital y un plan para montar tu barbería.');
  assert.equal(conConstancia('…desde casa, obtén tu constancia digital y cobra más.'), '…desde casa, obtén tu certificado digital y cobra más.');
  assert.equal(conConstancia('Aprende electricidad residencial desde cero y obtén tu constancia.'), 'Aprende electricidad residencial desde cero y obtén tu certificado.');
  assert.equal(conConstancia('Hotmart emite una constancia de finalización.'), 'Hotmart emite un certificado de finalización.');
  assert.equal(conConstancia('Lecciones en vídeo y con constancia al terminar.'), 'Lecciones en vídeo y con certificado al terminar.');
  assert.equal(conConstancia('Aprende a tatuar. Constancia y garantía de 7 días.'), 'Aprende a tatuar. Certificado y garantía de 7 días.');
  assert.equal(conConstancia('Constancia y garantía de 7 días incluidas.'), 'Certificado y garantía de 7 días incluidos.');
});

test('donde «constancia» es otra cosa, o ya dice «certificado», no se toca', () => {
  for (const texto of [
    'Practicando con constancia, la mayoría está lista en dos meses.',
    'Se guarda la constancia de tu consentimiento.',
    'Convertirse en barbero toma tiempo, constancia y decenas de cortes.',
    'Curso de velas artesanales para vender. Certificado incluido.',
    'Trabaja como electricista certificado en obras residenciales.',
    'Curso de masajes desde cero, con práctica guiada.',
  ]) assert.equal(conConstancia(texto), texto);
});
