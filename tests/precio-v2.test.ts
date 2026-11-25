import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importe } from '../src/lib/presentacion-v2.ts';

const nb = (s: string) => s.replace(/ /g, ' ');

test('importe: símbolo, formato del país y código en los ocho países', () => {
  const casos: [string, string, number, string, string][] = [
    ['es-CO', 'COP', 191012, '$ 191.012 COP', '191.012 pesos colombianos'],
    ['es-MX', 'MXN', 1173.92, '$ 1,173.92 MXN', '1,173.92 pesos mexicanos'],
    ['es-PE', 'PEN', 99, 'S/ 99.00 PEN', '99.00 soles peruanos'],
    ['es-CL', 'CLP', 19990, '$ 19.990 CLP', '19.990 pesos chilenos'],
    ['es-AR', 'ARS', 19990, '$ 19.990,00 ARS', '19.990,00 pesos argentinos'],
    ['es-EC', 'USD', 25, '$ 25,00 USD', '25,00 dólares estadounidenses'],
    ['es-US', 'USD', 25, '$ 25.00 USD', '25.00 dólares estadounidenses'],
    ['es-ES', 'EUR', 49.99, '49,99 € EUR', '49,99 euros'],
  ];
  for (const [locale, moneda, valor, texto, hablado] of casos) {
    const i = importe(valor, moneda, locale);
    assert.equal(i.texto, nb(texto), `${locale} texto`);
    assert.equal(i.hablado, hablado, `${locale} hablado`);
    assert.equal(i.codigo, moneda);
    assert.equal(`${i.visible} ${i.codigo}`, i.texto);
  }
});

test('importe: una moneda ajena al país lleva el símbolo largo', () => {
  assert.equal(importe(49.99, 'USD', 'es-ES').texto, nb('49,99 US$ USD'));
  assert.equal(importe(49.99, 'USD', 'es-CO').texto, nb('US$ 49,99 USD'));
  // México y Perú: Intl da «USD» como símbolo; el formato único pone «US$» para no leer «USD 49.99 USD».
  assert.equal(importe(49.99, 'USD', 'es-MX').texto, nb('US$ 49.99 USD'));
  assert.equal(importe(49.99, 'USD', 'es-PE').texto, nb('US$ 49.99 USD'));
});

test('importe: COP y CLP sin decimales aunque Hotmart mande fracción; descuentos con signo', () => {
  assert.equal(importe(95506.4, 'COP', 'es-CO').visible, nb('$ 95.506'));
  assert.equal(importe(-95506, 'COP', 'es-CO').texto, nb('−$ 95.506 COP'));
  assert.equal(importe(-595.66, 'MXN', 'es-MX').hablado, 'menos 595.66 pesos mexicanos');
});
