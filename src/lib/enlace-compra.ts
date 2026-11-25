/**
 * Enlace de compra de la ficha: reglas puras (sin red ni base de datos) para poder
 * probarlas con la cotización caída.
 *
 * 25-nov: cuando la cotización de Hotmart fallaba, la ficha caía a USD y el enlace
 * salía sin `countrycode` ni `offDiscount`: el comprador veía otro precio y pagaba
 * sin el cupón. La atribución del enlace no puede depender de que Hotmart responda.
 */
import type { CheckoutQuote } from './checkout-price';

/**
 * Cupón que va en el enlace aunque la caja no anuncie rebaja: el de la campaña que aplica a
 * este creador, salvo que Hotmart haya respondido que no lo aplica (cotización conocida sin
 * rebaja). Con oferta confirmada lo pone la caja en su propio enlace (`offer`), no aquí.
 */
export function cuponEnEnlace(coupon: string | null, conOferta: boolean, quote: Pick<CheckoutQuote, 'reducedKnown'> | null): string | null {
  if (!coupon) return null;
  return conOferta || !quote || !quote.reducedKnown ? coupon : null;
}

/** Enlace base del pago: país del checkout siempre y el cupón sin confirmar, si lo hay. */
export function enlaceDeCompra(ctaUrl: string, countryCode: string, cuponSinOferta: string | null): URL {
  const url = new URL(ctaUrl);
  url.searchParams.set('countrycode', countryCode.toUpperCase());
  if (cuponSinOferta) url.searchParams.set('offDiscount', cuponSinOferta);
  return url;
}
