import assert from 'node:assert/strict';
import test from 'node:test';
import { faqsHonestas, motivoFaqFalsa, type Faq } from '../src/lib/faq-honestas.ts';
import { faqPagoPais } from '../src/lib/medios-de-pago.ts';

const contexto = {
  precioTexto: 'US$49,99',
  faqPago: { q: '¿Cómo se realiza el pago?', a: 'Con tarjetas y métodos de pago locales.' },
};
const certificado: Faq = { q: '¿Recibo certificado?', a: 'Sí, un certificado digital al terminar.' };
const acceso: Faq = { q: '¿El acceso vence?', a: 'No. Una vez completado el pago, el acceso es de por vida.' };

// Casos tomados de fichas publicadas el 27-oct-2026.
test('a price the FAQ invented is replaced by the one the page shows', () => {
  const falsa = { q: '¿El precio de $32 USD ya tiene el descuento aplicado?', a: 'Sí, el precio final de $32 USD ya es el precio final.' };
  assert.equal(motivoFaqFalsa(falsa), 'precio');
  const [primera] = faqsHonestas([falsa, certificado], contexto);
  assert.equal(primera.q, '¿Cuánto cuesta el curso?');
  assert.match(primera.a, /US\$49,99/);
  assert.doesNotMatch(JSON.stringify(faqsHonestas([falsa, certificado], contexto)), /32 USD/);
});

test('the price word may sit in the question and the amount in the answer', () => {
  const faq = { q: '¿En qué moneda se procesa el cobro?', a: 'La plataforma convierte automáticamente los 27 USD a pesos mexicanos.' };
  assert.equal(motivoFaqFalsa(faq), 'precio');
});

test('launch discounts and payment methods nobody verified are dropped', () => {
  assert.equal(motivoFaqFalsa({ q: '¿El precio incluye el descuento?', a: 'Sí, ya verás aplicado el 40% de descuento de lanzamiento.' }), 'descuento');
  assert.equal(motivoFaqFalsa({ q: '¿Cómo pago desde Colombia?', a: 'Con PSE, Nequi o Daviplata.' }), 'medio-de-pago');
  assert.equal(motivoFaqFalsa({ q: '¿Puedo pagar desde España?', a: 'Con tarjeta o Bizum.' }), 'medio-de-pago');
});

test('what a student charges their own clients is not the course price', () => {
  const negocio = { q: '¿De verdad la gente paga por tortas para perros?', a: 'Sí. Una torta pet se vende entre 10 y 30 USD.' };
  assert.equal(motivoFaqFalsa(negocio), null);
  assert.deepEqual(faqsHonestas([negocio, certificado], contexto), [negocio, certificado]);
});

test('honest FAQ lists come back untouched', () => {
  const faqs = [certificado, acceso];
  assert.deepEqual(faqsHonestas(faqs, contexto), faqs);
});

test('several false answers leave a single price question', () => {
  const salida = faqsHonestas(
    [
      certificado,
      { q: '¿El precio de 29 USD es un pago único?', a: 'Sí, 29 USD una sola vez.' },
      { q: '¿Tengo que ingresar un código?', a: 'No, el 40% de descuento ya está aplicado.' },
      acceso,
    ],
    contexto,
  );
  assert.deepEqual(salida.map((f) => f.q), [certificado.q, '¿Cuánto cuesta el curso?', contexto.faqPago.q, acceso.q]);
});

test('the generic payment answer is added only when no payment question is left', () => {
  const metodos = { q: '¿Cómo puedo pagar desde Argentina?', a: 'Podés abonar con Mercado Pago.' };
  const conPago = faqsHonestas([metodos, acceso], contexto);
  assert.ok(conPago.some((f) => f.q === contexto.faqPago.q), 'a payment answer elsewhere is not a payment question');

  const otraPregunta = { q: '¿Puedo pagar en cuotas?', a: 'Depende de tu tarjeta.' };
  const sinGenerica = faqsHonestas([metodos, otraPregunta], contexto);
  assert.ok(!sinGenerica.some((f) => f.q === contexto.faqPago.q));
});

test('each country lists only the payment methods Hotmart documents for it', () => {
  const colombia = faqPagoPais({ code: 'co', name: 'Colombia' });
  assert.match(colombia.a, /PSE, Nequi, Bancolombia o Efecty/);
  assert.doesNotMatch(colombia.a, /Daviplata/);
  assert.doesNotMatch(faqPagoPais({ code: 'es', name: 'España' }).a, /Bizum/);
  assert.doesNotMatch(faqPagoPais({ code: 'ec', name: 'Ecuador' }).a, /admite además/);
});

test('the verified payment answer survives the filter that removes invented ones', () => {
  const peru = faqPagoPais({ code: 'pe', name: 'Perú' });
  const inventada = { q: '¿Puedo pagar con Plin?', a: 'Sí, con Plin o Yape.' };
  const salida = faqsHonestas([certificado, inventada, peru], { ...contexto, faqPago: peru });
  assert.deepEqual(salida.map((f) => f.q), [certificado.q, '¿Cuánto cuesta el curso?', peru.q]);
});
