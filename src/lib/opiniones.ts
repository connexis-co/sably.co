/**
 * Reglas para mostrar opiniones y notas (docs/equipo/2026-11-24/rediseno/benchmark/
 * widgets-opiniones.md): con menos de 5 opiniones no se muestra el promedio y con menos
 * de 10 no se muestran barras de reparto. La nota de Hotmart se cita como una cifra con
 * su fuente y la fecha en que se leyó, y nunca entra en el JSON-LD (es de un tercero).
 */
export const MINIMO_PROMEDIO = 5;
export const MINIMO_REPARTO = 10;

export const mostrarPromedio = (total: number) => Number.isFinite(total) && total >= MINIMO_PROMEDIO;
export const mostrarReparto = (total: number) => Number.isFinite(total) && total >= MINIMO_REPARTO;

/** «4,3» y «10 calificaciones en Hotmart, leídas el 24 nov. 2026»; null si no llega al mínimo. */
export function notaHotmart(valoracion: { rating: number; total: number; capturado?: number | null } | null | undefined, ahora = Date.now()) {
  if (!valoracion || !mostrarPromedio(valoracion.total) || !(valoracion.rating > 0)) return null;
  const cifra = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valoracion.rating);
  const capturado = valoracion.capturado ? (valoracion.capturado < 1e12 ? valoracion.capturado * 1000 : valoracion.capturado) : null;
  const fecha = capturado && capturado <= ahora
    ? fechaCorta(capturado)
    : null;
  return { cifra, texto: `${valoracion.total} calificaciones en Hotmart${fecha ? `, leídas el ${fecha}` : ''}` };
}

/** «24 nov. 2026» en hora de Colombia, igual en cualquier versión de ICU. */
function fechaCorta(ms: number): string {
  const partes = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(ms);
  const v = (t: string) => partes.find(p => p.type === t)?.value ?? '';
  return `${v('day')} ${v('month').replace(/\.$/, '')}. ${v('year')}`;
}
