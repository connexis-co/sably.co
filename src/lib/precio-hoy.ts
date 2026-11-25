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
import { checkoutPrice, quotable, quoteFreshUntil } from '@/lib/checkout-price';
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

export async function cotizarCurso(course: CursoConPrecio, country: Country, ctx: ContextoPrecio) {
  const db = baseDeDatos();
  /* Sin producto en Hotmart (`PENDIENTE`) no hay checkout: ni cotización ni cifra. */
  const sinProducto = /PENDIENTE/i.test(course.data.hotmartUrl);
  /* Hay creadores que no aceptan el cupón del sitio (src/lib/proveedores.ts). */
  const conCupon = aceptaCupon(course.data.proveedor);
  const proveedor = proveedorDe(course.data.proveedor);
  const real = await readOperationalPrice(db, course.id, country, ctx.locals).catch(() => null);
  const montoBase = real ? real.monto : localPrice(course.data.priceUSD, country);
  const monedaBase = real ? real.moneda : country.currency;
  const activePromos = await readActivePromosForRequest(db, ctx.locals).catch(() => []);
  const promoCtx = { countryCode: country.code, proveedor, courseSlug: course.id, urlKey: ctx.url.searchParams.get('promo') };
  const promoRow = mejorPromocion(activePromos, promoCtx);
  const coupon = conCupon && promoRow ? promoRow.cupon : null;
  const quote = sinProducto ? null : await checkoutPrice(course.id, course.data.hotmartUrl, country.code, coupon);
  /* La página no puede vivir en caché más que la cotización que pinta: Hotmart
     cambia la tasa de cambio sin aviso (24-nov: 93.067 en la ficha, 95.506 en el pago). */
  const freshUntil = sinProducto ? null : quoteFreshUntil(quote, quotable(course.id, course.data.hotmartUrl, country.code));
  const currency = quote?.currency ?? monedaBase;
  const baseAmount = quote?.base ?? montoBase;
  const saving = quote?.reduced ? Math.round(100 * (1 - quote.reduced / quote.base)) : 0;
  /* El cupón solo cuenta si Hotmart lo aplica y con el porcentaje que anuncia la campaña. */
  const conOferta = Boolean(coupon && quote?.reduced && promoRow && saving === promoRow.pct);
  return {
    sinProducto, conCupon, proveedor, real, montoBase, monedaBase, activePromos, promoCtx, promoRow, coupon, quote,
    freshUntil, currency, baseAmount, saving, conOferta,
  };
}

export type Cotizacion = Awaited<ReturnType<typeof cotizarCurso>>;

/** La cifra de la tarjeta a partir de lo que resolvió la ficha. */
export function tarjetaDe(c: Cotizacion): PrecioTarjeta | null {
  return precioDeTarjeta({
    sinProducto: c.sinProducto,
    conPrecio: Boolean(c.quote || c.real),
    currency: c.currency,
    baseAmount: c.baseAmount,
    reduced: c.conOferta ? c.quote!.reduced : null,
    coupon: c.conOferta ? c.coupon : null,
    saving: c.saving,
  });
}

/** Peticiones a Hotmart a la vez: un listado de 120 cursos no lanza 240 de golpe. */
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
      const c = await cotizarCurso(curso, country, ctx);
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
