/**
 * Aritmética y formato de precios. SIN datos: este módulo lo importan tanto el
 * build (hotmartLive.ts) como los scripts de cliente, y si viviera junto al
 * JSON de datos vivos, cada página arrastraría el catálogo entero al bundle.
 *
 * Es también la costura con el backend futuro: la promoción activa llega de
 * /api/v1/promo y el precio base de /api/v1/precios; cuando el panel Laravel
 * exista alimentará esas mismas dos fuentes y esta lógica queda igual.
 */

/** `$165.450 COP`, `US$49,99` — el número que cobra el checkout, sin convertir. */
export function formatMonto(monto: number, moneda: string): string {
  const decimales = Number.isInteger(monto) ? 0 : 2;
  const n = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(monto);
  return moneda === 'USD' ? `US$${n}` : `$${n} ${moneda}`;
}

/**
 * Precio con el cupón aplicado, redondeado hacia abajo igual que Hotmart.
 * Verificado en el checkout: 165.814 COP con −25 % muestra 124.360 (no
 * 124.361, que daría el redondeo al más cercano). Enteros en monedas sin
 * decimales; centavos en USD/EUR.
 */
export function precioConDescuento(monto: number, moneda: string, pct: number): number {
  const factor = 1 - pct / 100;
  return moneda === 'USD' || moneda === 'EUR'
    ? Math.floor(monto * factor * 100) / 100
    : Math.floor(monto * factor);
}
