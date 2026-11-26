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

type Valoracion = { rating: number; total: number; capturado?: number | null };

/** Milisegundos de la lectura (llega en segundos o en milisegundos); null si no hay o es futura. */
function msCaptura(v: Valoracion, ahora: number): number | null {
  const c = v.capturado ? (v.capturado < 1e12 ? v.capturado * 1000 : v.capturado) : null;
  return c && c <= ahora ? c : null;
}

/**
 * La nota de Hotmart lista para pintar; null si no llega al mínimo.
 * - `cifra` «4,3» y `texto` «10 calificaciones en Hotmart, leídas el 24 nov. 2026» (fuente y fecha: bloque de opiniones).
 * - `numero` «1.204» y `corto` «1.204 calificaciones»: la línea corta de la cabeza de la ficha y de las tarjetas
 *   (ronda 2 de JP, B y C2), que no repite la fuente en cada sitio.
 * - `accesible`: la frase entera con la fuente y la fecha, para lectores de pantalla y la ayuda al pasar el cursor.
 */
export function notaHotmart(valoracion: Valoracion | null | undefined, ahora = Date.now()) {
  if (!valoracion || !mostrarPromedio(valoracion.total) || !(valoracion.rating > 0)) return null;
  const cifra = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valoracion.rating);
  const numero = valoracion.total.toLocaleString('es-CO');
  const capturado = msCaptura(valoracion, ahora);
  const fecha = capturado ? fechaCorta(capturado) : null;
  const texto = `${numero} calificaciones en Hotmart${fecha ? `, leídas el ${fecha}` : ''}`;
  return { cifra, numero, total: valoracion.total, fecha, texto, corto: `${numero} calificaciones`, accesible: `${cifra} de 5 en ${texto}` };
}

/**
 * Pie de un listado con notas: la fuente y la fecha dichas una vez para todas las tarjetas.
 * «… leídas el 2 oct. 2026» o «… leídas entre el 2 oct. 2026 y el 24 nov. 2026»; null si ninguna nota se muestra.
 */
export function fuenteDeNotas(valoraciones: (Valoracion | null | undefined)[], ahora = Date.now()): string | null {
  const conNota = valoraciones.filter((v): v is Valoracion => !!notaHotmart(v, ahora));
  if (!conNota.length) return null;
  const fechas = [...new Set(conNota.map(v => msCaptura(v, ahora)).filter((c): c is number => c !== null).sort((a, b) => a - b).map(fechaCorta))];
  const cuando = fechas.length === 0 ? '' : fechas.length === 1 ? `, leídas el ${fechas[0]}` : `, leídas entre el ${fechas[0]} y el ${fechas.at(-1)}`;
  return `Las estrellas son la nota pública de cada curso en Hotmart y el número, sus calificaciones${cuando}. Solo se muestran con ${MINIMO_PROMEDIO} o más.`;
}

/** «24 nov. 2026» en hora de Colombia, igual en cualquier versión de ICU. */
function fechaCorta(ms: number): string {
  const partes = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(ms);
  const v = (t: string) => partes.find(p => p.type === t)?.value ?? '';
  return `${v('day')} ${v('month').replace(/\.$/, '')}. ${v('year')}`;
}
