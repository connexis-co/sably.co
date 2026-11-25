/**
 * Precio de un curso en un país, resuelto UNA sola vez y de la misma manera para
 * la ficha y para todas las tarjetas (portada, listado, categoría, relacionados,
 * perfil de creador): cotización viva de Hotmart con el cupón de la campaña que
 * aplica a ese creador, o la captura guardada si Hotmart no responde.
 *
 * `cargarFicha` (src/lib/ficha.ts) bebe de aquí; las tarjetas usan
 * `preciosDeTarjetas`, que además devuelve hasta cuándo vale la cifra para que
 * la página no viva en caché más que la cotización que pinta.
 */
import { env } from 'virtual:sably-runtime';
import { CARD_QUOTE_RETRY_MS, cardQuote, checkoutPrice, fijarAlmacenCotizaciones, quotable, quoteFreshUntil } from '@/lib/checkout-price';
import { almacenEnBase } from '@/lib/cotizaciones-guardadas';
import { cuponEnEnlace as cuponDelEnlace } from '@/lib/enlace-compra';
import { localPrice, type Country } from '@/lib/countries';
import { aceptaCupon, proveedorDe } from '@/lib/proveedores';
import { mejorPromocion } from '@/lib/promo';
import { readActivePromosForRequest, readOperationalPrice } from '@/plugins/sably-operations/public';
import type { Course } from '@/lib/emdash-content';
import { precioDeTarjeta, type PrecioTarjeta } from '@/lib/precio-tarjeta';

export interface ContextoPrecio {
  url: URL;
  /** Ámbito de la petición (Astro.locals): las lecturas de D1 se hacen una vez por petición. */
  locals: object;
}

type CursoConPrecio = Pick<Course, 'id'> & { data: Pick<Course['data'], 'hotmartUrl' | 'proveedor' | 'priceUSD'> };

const baseDeDatos = () => (env as unknown as { SABLY_DB: D1Database }).SABLY_DB;
/* La última cotización buena sobrevive a un reinicio en sably.db (tabla hotmart_cotizacion). */
fijarAlmacenCotizaciones(almacenEnBase(baseDeDatos));

/**
 * `ficha`: cotiza en vivo (espera corta, con la guardada de respaldo). `tarjeta`: nunca pregunta a
 * Hotmart al renderizar; lee el almacén y lo refresca en segundo plano (checkout-price `cardQuote`).
 */
export async function cotizarCurso(course: CursoConPrecio, country: Country, ctx: ContextoPrecio, modo: 'ficha' | 'tarjeta' = 'ficha') {
  const db = baseDeDatos();
  /* Sin producto en Hotmart (`PENDIENTE`) no hay checkout: ni cotización ni cifra. */
  const sinProducto = /PENDIENTE/i.test(course.data.hotmartUrl);
  /* Hay creadores que no aceptan el cupón del sitio (src/lib/proveedores.ts). */
  const conCupon = aceptaCupon(course.data.proveedor);
  const proveedor = proveedorDe(course.data.proveedor);
  const cotizable = quotable(course.id, course.data.hotmartUrl, country.code);
  const captura = await readOperationalPrice(db, course.id, country, ctx.locals).catch(() => null);
  const activePromos = await readActivePromosForRequest(db, ctx.locals).catch(() => []);
  const promoCtx = { countryCode: country.code, proveedor, courseSlug: course.id, urlKey: ctx.url.searchParams.get('promo') };
  const promoRow = mejorPromocion(activePromos, promoCtx);
  const coupon = conCupon && promoRow ? promoRow.cupon : null;
  /* En vivo o, si Hotmart falla o tarda, la última buena guardada con su fecha (`quote.fuente`). */
  const quote = sinProducto ? null : await (modo === 'tarjeta' ? cardQuote : checkoutPrice)(course.id, course.data.hotmartUrl, country.code, coupon);
  /* Un curso que se cotiza no cae a la captura de octubre (USD en casi todos los países): sin
     cotización viva ni guardada no hay importe. La captura solo vale para los que no se cotizan. */
  const real = cotizable && !quote ? null : captura;
  const montoBase = real ? real.monto : localPrice(course.data.priceUSD, country);
  const monedaBase = real ? real.moneda : country.currency;
  /* La página no puede vivir en caché más que la cotización que pinta: Hotmart
     cambia la tasa de cambio sin aviso (24-nov: 93.067 en la ficha, 95.506 en el pago). */
  /* Tarjeta sin cotización todavía (pedida en segundo plano): la página vuelve pronto con ella. */
  const freshUntil = sinProducto ? null : modo === 'tarjeta' && !quote && cotizable ? Date.now() + CARD_QUOTE_RETRY_MS : quoteFreshUntil(quote, cotizable);
  const currency = quote?.currency ?? monedaBase;
  const baseAmount = quote?.base ?? montoBase;
  const saving = quote?.reduced ? Math.round(100 * (1 - quote.reduced / quote.base)) : 0;
  /* El cupón solo cuenta si Hotmart lo aplica y con el porcentaje que anuncia la campaña. */
  const conOferta = Boolean(coupon && quote?.reduced && promoRow && saving === promoRow.pct);
  /* ¿Hay importe que enseñar? Cotización (viva o guardada) o, en un curso que no se cotiza, la captura. */
  const conPrecio = Boolean(quote || real);
  /* El cupón de la campaña va SIEMPRE en el enlace cuando aplica a este creador, aunque no se haya
     podido confirmar con Hotmart (cotización caída o guardada sin ese cupón). Solo se quita cuando
     Hotmart respondió que no lo aplica. Sin confirmar, no se anuncia importe rebajado. */
  const cuponEnEnlace = cuponDelEnlace(coupon, conOferta, quote);
  return {
    sinProducto, conCupon, proveedor, real, montoBase, monedaBase, activePromos, promoCtx, promoRow, coupon, quote,
    freshUntil, currency, baseAmount, saving, conOferta, conPrecio, cuponEnEnlace,
  };
}

export type Cotizacion = Awaited<ReturnType<typeof cotizarCurso>>;

/** La cifra de la tarjeta a partir de lo que resolvió la ficha. */
export function tarjetaDe(c: Cotizacion): PrecioTarjeta | null {
  return precioDeTarjeta({
    sinProducto: c.sinProducto,
    conPrecio: c.conPrecio,
    currency: c.currency,
    baseAmount: c.baseAmount,
    reduced: c.conOferta ? c.quote!.reduced : null,
    coupon: c.conOferta ? c.coupon : null,
    saving: c.saving,
  });
}

/** Tarjetas resueltas a la vez (solo memoria y sably.db: las tarjetas ya no preguntan a Hotmart al renderizar). */
const A_LA_VEZ = 12;

/**
 * Precio de varias tarjetas y el plazo (ms) hasta el que vale el más corto de
 * ellos, para pasarlo como `freshUntil` al layout. Las cotizaciones se comparten
 * con las fichas (misma caché en memoria por curso y país).
 */
export async function preciosDeTarjetas(cursos: readonly CursoConPrecio[], country: Country, ctx: ContextoPrecio) {
  const unicos = [...new Map(cursos.map(c => [c.id, c])).values()];
  const precios = new Map<string, PrecioTarjeta | null>();
  let freshUntil: number | null = null;
  let siguiente = 0;
  const trabajar = async () => {
    while (siguiente < unicos.length) {
      const curso = unicos[siguiente++]!;
      const c = await cotizarCurso(curso, country, ctx, 'tarjeta');
      precios.set(curso.id, tarjetaDe(c));
      if (c.freshUntil !== null && (freshUntil === null || c.freshUntil < freshUntil)) freshUntil = c.freshUntil;
    }
  };
  await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, unicos.length) }, trabajar));
  return { precios, freshUntil };
}

/** El más próximo de dos plazos (ms); `null` = sin plazo. */
export function plazoMasCorto(a: number | null | undefined, b: number | null | undefined): number | null {
  const plazos = [a, b].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return plazos.length ? Math.min(...plazos) : null;
}
