import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCheckoutPrice, QUOTE_RETRY_MS, QUOTE_TTL_MS, quoteFreshUntil } from '../src/lib/checkout-price';
import { earliestBoundary, pageMaxAge, PUBLIC_PAGE_TTL } from '../src/lib/public-delivery';

const KEY = 'oferta-de-prueba';
const URL_CURSO = 'https://hotm.io/curso-de-prueba';
const sources = {
  'curso-de-prueba': { url: URL_CURSO, product: '111', codigo: 'A1', ofertaSha256: createHash('sha256').update(KEY).digest('hex') },
};

/** Respuesta mínima de la cotización de Hotmart: total con tarjeta, con o sin cupón. */
function respuesta(market: string, currency: string, value: number, coupon: boolean) {
  return {
    data: {
      countryIsoCode: market,
      products: [{
        id: 111,
        offer: {
          key: KEY,
          paymentMethods: [
            { type: 'CASH_PAYMENT', amount: { currency, value: value - 6 } },
            {
              type: 'CREDIT_CARD', amount: { currency, value },
              additionalData: { isCouponApplied: coupon },
              summary: { items: coupon ? [{ type: 'COUPON', value }] : [{ type: 'FULL_PRICE', value }] },
            },
          ],
        },
      }],
    },
  };
}

function hotmart(prices: { base: number; reduced: number }) {
  const calls: (string | null)[] = [];
  let down = false;
  return {
    calls,
    prices,
    apagar: (value: boolean) => { down = value; },
    load: async (row: { market: string; currency: string }, _source: unknown, coupon: string | null) => {
      calls.push(coupon);
      if (down) throw new Error('sin respuesta');
      return respuesta(row.market, row.currency, coupon ? prices.reduced : prices.base, Boolean(coupon));
    },
  };
}

test('una sola cotización por curso y país: el cupón no abre otra entrada con otro precio base', async () => {
  const api = hotmart({ base: 186134, reduced: 93067 });
  let clock = 1_000_000;
  const { checkoutPrice } = createCheckoutPrice({ sources, load: api.load, now: () => clock });

  const sinCupon = await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', null);
  assert.deepEqual([sinCupon?.base, sinCupon?.reduced, sinCupon?.currency], [186134, null, 'COP']);

  // Hotmart cambia la tasa. Una visita con cupón dentro de la misma hora vuelve
  // a leer los dos importes juntos y sustituye la entrada completa.
  api.prices.base = 191012; api.prices.reduced = 95506;
  clock += 60_000;
  const conCupon = await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', '031016');
  assert.deepEqual([conCupon?.base, conCupon?.reduced], [191012, 95506]);

  // Y la visita sin cupón ve ya ese mismo precio base, no el que tenía guardado.
  const otraVez = await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', null);
  assert.equal(otraVez?.base, 191012);
  assert.equal(otraVez?.validUntil, conCupon?.validUntil);
});

test('dentro de su vida la cotización no vuelve a preguntar a Hotmart y luego caduca', async () => {
  const api = hotmart({ base: 1191.32, reduced: 595.66 });
  let clock = 5_000_000;
  const { checkoutPrice } = createCheckoutPrice({ sources, load: api.load, now: () => clock });

  const first = await checkoutPrice('curso-de-prueba', URL_CURSO, 'mx', '031016');
  assert.deepEqual([first?.base, first?.reduced, first?.currency], [1191.32, 595.66, 'MXN']);
  assert.equal(first?.validUntil, 5_000_000 + QUOTE_TTL_MS);
  assert.equal(api.calls.length, 2);

  clock += QUOTE_TTL_MS - 1;
  await checkoutPrice('curso-de-prueba', URL_CURSO, 'mx', '031016');
  await checkoutPrice('curso-de-prueba', URL_CURSO, 'mx', null);
  assert.equal(api.calls.length, 2);

  clock += 1;
  api.prices.base = 1200; api.prices.reduced = 600;
  const later = await checkoutPrice('curso-de-prueba', URL_CURSO, 'mx', '031016');
  assert.deepEqual([later?.base, later?.reduced], [1200, 600]);
  assert.equal(api.calls.length, 4);
});

test('dos visitas simultáneas comparten la misma lectura', async () => {
  const api = hotmart({ base: 49.99, reduced: 25 });
  const { checkoutPrice } = createCheckoutPrice({ sources, load: api.load, now: () => 1 });
  const [a, b] = await Promise.all([
    checkoutPrice('curso-de-prueba', URL_CURSO, 'ec', '031016'),
    checkoutPrice('curso-de-prueba', URL_CURSO, 'ec', '031016'),
  ]);
  assert.deepEqual(a, b);
  assert.equal(api.calls.length, 2);
});

test('si Hotmart no aplica el cupón, la ficha conserva el precio base y no inventa descuento', async () => {
  const api = hotmart({ base: 217797, reduced: 217797 });
  const { checkoutPrice } = createCheckoutPrice({
    sources, now: () => 1,
    // Hotmart ignora el cupón: responde el precio completo sin marcarlo aplicado.
    load: async (row: { market: string; currency: string }) => respuesta(row.market, row.currency, api.prices.base, false),
  });
  const quote = await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', 'NOEXISTE');
  assert.deepEqual([quote?.base, quote?.reduced], [217797, null]);
});

test('si Hotmart no responde no hay cotización y no se le insiste hasta el plazo de reintento', async () => {
  const api = hotmart({ base: 186134, reduced: 93067 });
  let clock = 9_000_000;
  const { checkoutPrice, quotable } = createCheckoutPrice({ sources, load: api.load, now: () => clock });
  api.apagar(true);
  assert.equal(await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', '031016'), null);
  assert.equal(api.calls.length, 2);
  clock += QUOTE_RETRY_MS - 1;
  assert.equal(await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', '031016'), null);
  assert.equal(api.calls.length, 2);

  api.apagar(false);
  clock += 1;
  assert.equal((await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', '031016'))?.reduced, 93067);

  // Sin fuente comprobada (otro destino, otro curso u otro país) no se cotiza.
  assert.equal(quotable('curso-de-prueba', URL_CURSO, 'co'), true);
  assert.equal(quotable('curso-de-prueba', 'https://hotm.io/otro', 'co'), false);
  assert.equal(quotable('otro-curso', URL_CURSO, 'co'), false);
  assert.equal(quotable('curso-de-prueba', URL_CURSO, 'br'), false);
  assert.equal(await checkoutPrice('curso-de-prueba', 'https://hotm.io/otro', 'co', null), null);
});

test('la ficha no vive en caché más que la cotización que pinta', () => {
  const now = 1_795_000_000;
  const quote = { currency: 'COP', base: 191012, reduced: 95506, at: now * 1000, validUntil: now * 1000 + QUOTE_TTL_MS };
  // Con cotización: lo que le quede, aunque la promoción termine más tarde.
  assert.equal(pageMaxAge(earliestBoundary(now + 80_000, quoteFreshUntil(quote, true)), now), QUOTE_TTL_MS / 1000);
  // La promoción termina antes: manda ella.
  assert.equal(pageMaxAge(earliestBoundary(now + 600, quoteFreshUntil(quote, true)), now), 600);
  // Hotmart no respondió: la página con el precio de respaldo dura el plazo de reintento.
  assert.equal(pageMaxAge(earliestBoundary(null, quoteFreshUntil(null, true, now * 1000)), now), QUOTE_RETRY_MS / 1000);
  // Curso sin producto o página sin precio: nada cambia respecto a hoy.
  assert.equal(quoteFreshUntil(null, false), null);
  assert.equal(pageMaxAge(earliestBoundary(null, null), now), PUBLIC_PAGE_TTL);
  assert.equal(pageMaxAge(earliestBoundary(now + 900, undefined), now), 900);
});
