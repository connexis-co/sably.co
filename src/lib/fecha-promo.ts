/**
 * Fechas de fin de promoción tal como se le dicen al visitante.
 *
 * La campaña se carga en hora de Colombia y la caja de compra la anuncia así
 * («Vigente hasta el … (Bogotá)»), en los ocho países. La pregunta frecuente de
 * precio y el `Offer` del JSON-LD usan estas mismas funciones para no decir una
 * fecha distinta de la que enseña la caja.
 */
const ZONA = 'America/Bogota';

/** «25 de noviembre de 2026 a las 7:00 p. m.» */
export function fechaFinPromo(ms: number): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(ms)).replace(/[  ]/g, ' ');
}

/** «2026-11-25»: el día, para `priceValidUntil`. */
export function fechaColombia(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
