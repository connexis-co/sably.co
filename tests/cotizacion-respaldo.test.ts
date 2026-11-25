/**
 * Cotización de Hotmart caída: el enlace de compra conserva su atribución completa y el
 * precio sale de la última cotización buena guardada, en las ocho monedas.
 *
 * 25-nov (cuarto despliegue, «Trampa encontrada»): con la cotización fallida la ficha caía
 * a USD y el enlace salía sin `offDiscount` ni `countrycode` (4 de 16 fichas en una pasada).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCheckoutPrice, QUOTE_RETRY_MS, type AlmacenCotizaciones, type CotizacionGuardada } from '../src/lib/checkout-price';
import { cuponEnEnlace, enlaceDeCompra } from '../src/lib/enlace-compra';
import { buildHotmartUrl } from '../src/lib/hotmart';
import { precioDeTarjeta } from '../src/lib/precio-tarjeta';

const KEY = 'oferta-de-prueba';
const URL_CURSO = 'https://hotm.io/curso-de-prueba';
const sources = { 'curso-de-prueba': { url: URL_CURSO, product: '111', codigo: 'A1', ofertaSha256: createHash('sha256').update(KEY).digest('hex') } };
const CUPON = '031016';

/** Los ocho mercados, su moneda y un importe con el formato de cada uno. */
const MERCADOS: [string, string, number][] = [
  ['co', 'COP', 191012], ['mx', 'MXN', 1191.32], ['pe', 'PEN', 189.9], ['ec', 'USD', 49.99],
  ['cl', 'CLP', 64839.53], ['ar', 'ARS', 72499.5], ['es', 'EUR', 59.29], ['us', 'USD', 49.99],
];

function respuesta(market: string, currency: string, value: number, coupon: boolean) {
  return { data: { countryIsoCode: market, products: [{ id: 111, offer: { key: KEY, paymentMethods: [{
    type: 'CREDIT_CARD', amount: { currency, value }, additionalData: { isCouponApplied: coupon },
    summary: { items: coupon ? [{ type: 'COUPON', value }] : [{ type: 'FULL_PRICE', value }] },
  }] } }] } };
}

type Fallo = 'ninguno' | 'red' | '500' | 'tiempo';
/** Hotmart simulado: responde, se cae de la red, da 500 o no contesta a tiempo. */
function hotmart(base: number) {
  let fallo: Fallo = 'ninguno';
  return {
    fallar: (f: Fallo) => { fallo = f; },
    load: async (row: { market: string; currency: string }, _s: unknown, coupon: string | null) => {
      if (fallo === 'red') throw new TypeError('fetch failed');
      if (fallo === '500') throw new Error('Cotización no disponible (500)');
      if (fallo === 'tiempo') return new Promise((_, no) => setTimeout(() => no(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), 40));
      return respuesta(row.market, row.currency, coupon ? Math.round(base * 50) / 100 : base, Boolean(coupon));
    },
  };
}

/** Almacén en memoria con la misma interfaz que el de sably.db (sobrevive al «reinicio»). */
function almacenDePrueba(): AlmacenCotizaciones & { filas: Map<string, CotizacionGuardada> } {
  const filas = new Map<string, CotizacionGuardada>();
  return {
    filas,
    async leer(slug, market, coupon) { return filas.get(`${slug}|${market}|${coupon ?? ''}`) ?? filas.get(`${slug}|${market}|`) ?? null; },
    async guardar(slug, market, c) { filas.set(`${slug}|${market}|${c.cupon ?? ''}`, c); },
  };
}

/** Lo que la ficha haría con la cotización: enlace de compra y cifra de la tarjeta. */
function ficha(market: string, quote: Awaited<ReturnType<ReturnType<typeof createCheckoutPrice>['checkoutPrice']>>) {
  const saving = quote?.reduced ? Math.round(100 * (1 - quote.reduced / quote.base)) : 0;
  const conOferta = Boolean(quote?.reduced && saving === 50);
  const base = buildHotmartUrl({ baseUrl: URL_CURSO, aceptaCupon: true, courseSlug: 'curso-de-prueba', countryCode: market });
  const enlace = enlaceDeCompra(base, market, conOferta ? null : cuponEnEnlace(CUPON, conOferta, quote));
  // Con oferta confirmada la caja pone el cupón en su enlace inicial (CajaCompra: `discounted`).
  if (conOferta) enlace.searchParams.set('offDiscount', CUPON);
  const precio = precioDeTarjeta({ sinProducto: false, conPrecio: Boolean(quote), currency: quote?.currency ?? '???', baseAmount: quote?.base ?? 0, reduced: conOferta ? quote!.reduced : null, coupon: conOferta ? CUPON : null, saving });
  return { enlace, precio };
}

const atribucionCompleta = (enlace: URL, market: string) => {
  assert.equal(enlace.searchParams.get('countrycode'), market.toUpperCase(), `${market}: countrycode`);
  assert.equal(enlace.searchParams.get('offDiscount'), CUPON, `${market}: offDiscount`);
  assert.equal(enlace.searchParams.get('src'), 'sably', `${market}: src`);
  assert.equal(enlace.searchParams.get('utm_source'), 'sably.co', `${market}: utm_source`);
  assert.equal(enlace.searchParams.get('utm_campaign'), 'course_curso-de-prueba', `${market}: utm_campaign`);
};

for (const fallo of ['red', '500', 'tiempo'] as const) {
  test(`Hotmart con ${fallo}: precio de la última cotización guardada, en su moneda y con su fecha, y enlace completo (8 monedas)`, async () => {
    for (const [market, currency, base] of MERCADOS) {
      const api = hotmart(base);
      const almacen = almacenDePrueba();
      let clock = 1_000_000;
      const primero = createCheckoutPrice({ sources, load: api.load, now: () => clock, almacen: () => almacen, esperaConGuardada: 10 });
      const buena = await primero.checkoutPrice('curso-de-prueba', URL_CURSO, market, CUPON);
      assert.equal(buena?.fuente, 'hotmart');
      // Pasa la hora de vida y Hotmart falla: en el mismo proceso (memoria) y tras un reinicio (almacén).
      clock += 3_600_000 + 1;
      api.fallar(fallo);
      const reiniciado = createCheckoutPrice({ sources, load: api.load, now: () => clock, almacen: () => almacen, esperaConGuardada: 10 });
      for (const instancia of [primero, reiniciado]) {
        const quote = await instancia.checkoutPrice('curso-de-prueba', URL_CURSO, market, CUPON);
        assert.equal(quote?.fuente, 'guardada', `${market}: fuente`);
        assert.equal(quote?.currency, currency, `${market}: nunca cae a otra moneda`);
        assert.equal(quote?.base, base);
        assert.equal(quote?.reduced, Math.round(base * 50) / 100);
        assert.equal(quote?.at, 1_000_000, `${market}: conserva la fecha de lectura`);
        assert.equal(quote?.validUntil, clock + QUOTE_RETRY_MS, `${market}: la página no se queda en caché con la guardada`);
        const { enlace, precio } = ficha(market, quote);
        atribucionCompleta(enlace, market);
        assert.deepEqual([precio?.hoy, precio?.normal, precio?.moneda], [Math.round(base * 50) / 100, base, currency]);
      }
    }
  });
}

test('sin ninguna cotización guardada: sin importe (nunca uno inventado) y el enlace sigue completo (8 monedas)', async () => {
  for (const [market] of MERCADOS) {
    const api = hotmart(1);
    api.fallar('500');
    const { checkoutPrice } = createCheckoutPrice({ sources, load: api.load, now: () => 1, almacen: () => almacenDePrueba() });
    const quote = await checkoutPrice('curso-de-prueba', URL_CURSO, market, CUPON);
    assert.equal(quote, null);
    const { enlace, precio } = ficha(market, quote);
    atribucionCompleta(enlace, market);
    assert.equal(precio, null, `${market}: la tarjeta y la caja no enseñan cifra`);
  }
});

test('guardada sin lectura con el cupón: el enlace lleva el cupón, pero no se anuncia rebaja', async () => {
  const api = hotmart(191012);
  const almacen = almacenDePrueba();
  let clock = 1;
  const a = createCheckoutPrice({ sources, load: api.load, now: () => clock, almacen: () => almacen, esperaConGuardada: 10 });
  await a.checkoutPrice('curso-de-prueba', URL_CURSO, 'co', null);
  clock += 3_600_001;
  api.fallar('red');
  const quote = await a.checkoutPrice('curso-de-prueba', URL_CURSO, 'co', CUPON);
  assert.deepEqual([quote?.fuente, quote?.base, quote?.reduced, quote?.reducedKnown], ['guardada', 191012, null, false]);
  const { enlace, precio } = ficha('co', quote);
  atribucionCompleta(enlace, 'co');
  assert.deepEqual([precio?.hoy, precio?.normal], [191012, null]);
});

test('si Hotmart respondió que el cupón no aplica, el enlace no lo lleva', () => {
  assert.equal(cuponEnEnlace(CUPON, false, { reducedKnown: true }), null);
  assert.equal(cuponEnEnlace(CUPON, false, null), CUPON);
  assert.equal(cuponEnEnlace(CUPON, false, { reducedKnown: false }), CUPON);
  assert.equal(cuponEnEnlace(null, false, null), null);
});

test('Hotmart que tarda: el render no espera más que el instante fijado y la lectura sigue para la próxima', async () => {
  const almacen = almacenDePrueba();
  await almacen.guardar('curso-de-prueba', 'CO', { currency: 'COP', base: 186134, reduced: 93067, cupon: CUPON, at: 5 });
  let responder: (() => void) | undefined;
  const { checkoutPrice } = createCheckoutPrice({
    sources, now: () => 10_000, almacen: () => almacen, esperaConGuardada: 20,
    load: (row: { market: string; currency: string }, _s: unknown, coupon: string | null) =>
      new Promise((ok) => { responder = () => ok(respuesta(row.market, row.currency, coupon ? 95506 : 191012, Boolean(coupon))); setTimeout(responder, 200); }),
  });
  const inicio = Date.now();
  const lenta = await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', CUPON);
  assert.ok(Date.now() - inicio < 150, 'no bloquea el render esperando a Hotmart');
  assert.deepEqual([lenta?.fuente, lenta?.base, lenta?.reduced], ['guardada', 186134, 93067]);
  await new Promise((ok) => setTimeout(ok, 250));
  const despues = await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', CUPON);
  assert.deepEqual([despues?.fuente, despues?.base, despues?.reduced], ['hotmart', 191012, 95506]);
  assert.equal((await almacen.leer('curso-de-prueba', 'CO', CUPON))?.base, 191012, 'la lectura nueva queda guardada');
});

test('sin cotización guardada y Hotmart colgado: el render espera como mucho el instante fijado', async () => {
  const { checkoutPrice } = createCheckoutPrice({
    sources, now: () => 1, esperaSinGuardada: 30,
    load: () => new Promise((_, no) => setTimeout(() => no(new Error('colgado')), 300)),
  });
  const inicio = Date.now();
  assert.equal(await checkoutPrice('curso-de-prueba', URL_CURSO, 'co', CUPON), null);
  assert.ok(Date.now() - inicio < 200, 'no espera al tiempo máximo de la petición');
});

test('tarjetas: nunca esperan a Hotmart, leen el almacén y lo refrescan en segundo plano por una cola limitada', async () => {
  const almacen = almacenDePrueba();
  let clock = 10_000_000;
  let llamadas = 0, simultaneas = 0, maximo = 0;
  const { cardQuote } = createCheckoutPrice({
    sources: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`curso-${i}`, { ...sources['curso-de-prueba'], url: `https://hotm.io/c${i}` }])),
    now: () => clock, almacen: () => almacen, colaParalelo: 2, colaPausaMs: 0,
    load: async (row: { market: string; currency: string }, _s: unknown, coupon: string | null) => {
      llamadas++; simultaneas++; maximo = Math.max(maximo, simultaneas);
      await new Promise((ok) => setTimeout(ok, 20));
      simultaneas--;
      return respuesta(row.market, row.currency, coupon ? 95506 : 191012, Boolean(coupon));
    },
  });
  // Sin nada guardado: null al instante (sin cifra) y la lectura queda en cola.
  const inicio = Date.now();
  const primeras = await Promise.all(Array.from({ length: 10 }, (_, i) => cardQuote(`curso-${i}`, `https://hotm.io/c${i}`, 'co', CUPON)));
  assert.ok(Date.now() - inicio < 50, 'el render no espera a Hotmart');
  assert.ok(primeras.every((q) => q === null));
  await new Promise((ok) => setTimeout(ok, 400));
  assert.equal(llamadas, 20, 'una lectura (con y sin cupón) por curso, sin repetir');
  assert.ok(maximo <= 4, `como mucho 2 lecturas a la vez (cada una son 2 peticiones): ${maximo}`);
  // Ya guardadas: las tarjetas las enseñan sin preguntar a Hotmart.
  const despues = await cardQuote('curso-3', 'https://hotm.io/c3', 'co', CUPON);
  assert.deepEqual([despues?.base, despues?.reduced, despues?.fuente], [191012, 95506, 'hotmart']);
  assert.equal(llamadas, 20);
  // Con más de 30 min: se enseña igual (con su fecha) y se refresca en segundo plano.
  clock += 31 * 60_000;
  const vieja = await cardQuote('curso-3', 'https://hotm.io/c3', 'co', CUPON);
  assert.deepEqual([vieja?.fuente, vieja?.base], ['guardada', 191012]);
  await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(llamadas, 22, 'la vieja se pidió de nuevo, una sola vez');
});
