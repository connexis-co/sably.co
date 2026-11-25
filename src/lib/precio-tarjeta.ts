/**
 * Qué precio enseña una tarjeta de curso: lo mismo que la ficha da como precio a
 * pagar hoy, nunca otro dato. Reglas puras (sin base de datos ni red) para
 * poder probarlas; la lectura vive en `precio-hoy.ts`.
 *
 * Antes cada tarjeta leía `hotmart_precio`, una captura del 2 de octubre, y la
 * ficha la cotización viva de Hotmart: el 25-nov la portada de /co/ decía
 * «$ 163.800 COP» en todos los cursos de 49,99 USD mientras la ficha de masajes
 * cobraba 191.012 (95.506 con el cupón de Black Friday).
 */

/** Lo que la ficha resolvió para un curso y un país (ver `cotizarCurso`). */
export interface CotizacionCurso {
  sinProducto: boolean;
  /** ¿Hay precio de Hotmart: cotización viva o captura guardada? Sin ninguno la ficha dice «lo ves en Hotmart». */
  conPrecio: boolean;
  currency: string;
  /** Precio sin cupón que pinta la ficha. */
  baseAmount: number;
  /** Precio con cupón, solo cuando la campaña aplica de verdad a este curso y país. */
  reduced: number | null;
  coupon: string | null;
  saving: number;
}

export interface PrecioTarjeta {
  /** Lo que se paga hoy: el rebajado si la campaña aplica, si no el normal. */
  hoy: number;
  /** Precio normal, solo para tacharlo al lado cuando hay campaña. */
  normal: number | null;
  moneda: string;
  cupon: string | null;
  ahorro: number | null;
}

/** `null` = la tarjeta no muestra precio (curso sin producto o sin precio de Hotmart: nunca un valor de relleno). */
export function precioDeTarjeta(c: CotizacionCurso): PrecioTarjeta | null {
  if (c.sinProducto || !c.conPrecio || !(c.baseAmount > 0)) return null;
  const rebajado = c.reduced !== null && c.coupon !== null && c.reduced < c.baseAmount ? c.reduced : null;
  return {
    hoy: rebajado ?? c.baseAmount,
    normal: rebajado === null ? null : c.baseAmount,
    moneda: c.currency,
    cupon: rebajado === null ? null : c.coupon,
    ahorro: rebajado === null ? null : c.saving,
  };
}

/** Importe comparable entre cursos para ordenar por precio (la moneda puede ser USD en un país que no lo usa). */
export function importeParaOrdenar(precio: PrecioTarjeta | null | undefined, usdRate: number, monedaPais: string): number {
  if (!precio) return Number.MAX_SAFE_INTEGER; // al final, y la resta entre dos sin precio da 0 (no NaN)
  return precio.moneda === 'USD' && monedaPais !== 'USD' ? precio.hoy * usdRate : precio.hoy;
}
