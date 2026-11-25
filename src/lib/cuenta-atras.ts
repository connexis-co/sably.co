/**
 * Texto del contador de campaña. Sin segundos y sin cifras que «corren»: días,
 * horas y minutos hasta la fecha de fin REAL de la campaña del panel. Nunca se
 * reinicia: al llegar la fecha devuelve null y la caja vuelve al precio normal.
 * Lo usan el servidor (primer pintado) y el navegador (cada 30 s).
 */
const ZONA = 'America/Bogota';

export interface Restante { dias: number; horas: number; minutos: number }

export function restante(hasta: number, ahora: number): Restante | null {
  const ms = hasta - ahora;
  if (!(ms > 0)) return null;
  const minutosTotales = Math.ceil(ms / 60_000);
  return { dias: Math.floor(minutosTotales / 1440), horas: Math.floor((minutosTotales % 1440) / 60), minutos: minutosTotales % 60 };
}

/** «2 d 21 h», «21 h 30 min», «12 min». */
export function textoRestante(r: Restante): string {
  if (r.dias > 0) return `${r.dias} d ${r.horas} h`;
  if (r.horas > 0) return `${r.horas} h ${r.minutos} min`;
  return `${r.minutos} min`;
}

/** Fracción de la campaña que aún queda (1 al empezar, 0 al terminar). Sin inicio conocido, 1. */
export function fraccionRestante(desde: number | null | undefined, hasta: number, ahora: number): number {
  if (!desde || desde >= hasta) return ahora < hasta ? 1 : 0;
  return Math.min(1, Math.max(0, (hasta - ahora) / (hasta - desde)));
}

/** «25 nov., 7:00 p. m.» en hora de Colombia, como la anuncia la caja. */
export function fechaCorta(ms: number): string {
  const partes = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(new Date(ms));
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? '';
  const mes = valor('month').replace(/\.$/, '');
  const periodo = valor('dayPeriod').replace(/[\u202f\u00a0]/g, ' ');
  return `${valor('day')} ${mes}., ${valor('hour')}:${valor('minute')} ${periodo}`;
}

/** «29 nov.» en hora de Colombia: el día en que termina, sin la hora. */
export function fechaDia(ms: number): string {
  const partes = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short' }).formatToParts(new Date(ms));
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? '';
  return `${valor('day')} ${valor('month').replace(/\.$/, '')}.`;
}
