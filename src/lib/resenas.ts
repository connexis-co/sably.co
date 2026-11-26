/**
 * Reseñas públicas que una ficha puede enseñar bajo «Lo que dicen los
 * compradores»: solo las del propio curso.
 *
 * Hasta el 24-nov-2026 la sección se completaba hasta seis tarjetas con reseñas
 * de otros cursos de la categoría. Soldadura y tatuaje (este sin producto)
 * enseñaban opiniones de «Reparación de Lavadoras» bajo un título que las
 * atribuía al curso de la página. Rotularlas en pequeño no lo arreglaba.
 */

/** Con menos reseñas propias la sección no se pinta: una o dos no son «lo que dicen los compradores». */
export const MIN_RESENAS = 3;
export const MAX_RESENAS = 6;
/** La captura de Hotmart guardó como mucho 120 caracteres: un texto de ese largo está cortado. */
export const LIMITE_CAPTURA = 120;

export interface ResenaPublica {
  slug: string;
  nombre: string;
  rating: number;
  texto: string;
  source: string;
}

/**
 * La cita, sin terminar a media palabra. Un texto más corto que el límite de
 * captura está entero y se devuelve tal cual. Uno cortado se cierra en su
 * última frase completa; si no tiene ninguna, en la última palabra entera y con
 * puntos suspensivos, que es la forma honesta de decir que la reseña sigue.
 */
export function citaSinCortar(texto: string, limite = LIMITE_CAPTURA): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length < limite) return limpio;
  const frases = limpio.match(/^.*[.!?…](?=\s)/)?.[0];
  if (frases && frases.length >= limpio.length * 0.4) return frases.trim();
  const palabras = limpio.slice(0, limpio.lastIndexOf(' ')).replace(/[\s,;:¡¿(«"“-]+$/, '');
  return palabras ? `${palabras}…` : limpio;
}

/** «MARCOS» → «Marcos»: el nombre es el que su autor publicó; solo se le quita el grito. */
export function nombreLegible(nombre: string): string {
  const limpio = nombre.replace(/\s+/g, ' ').trim();
  if (limpio.length < 2 || limpio !== limpio.toLocaleUpperCase('es') || limpio === limpio.toLocaleLowerCase('es')) return limpio;
  return limpio.toLocaleLowerCase('es').replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase('es'));
}

/** Las reseñas de Hotmart de ESTE curso, o ninguna si no llegan al mínimo. */
export function resenasPropias<T extends ResenaPublica>(reviews: readonly T[], slug: string): T[] {
  const propias = reviews
    .filter((r) => r.source === 'hotmart-public' && r.slug === slug && r.texto.trim())
    .map((r) => ({ ...r, nombre: nombreLegible(r.nombre), texto: citaSinCortar(r.texto) }));
  return propias.length >= MIN_RESENAS ? propias.slice(0, MAX_RESENAS) : [];
}

/**
 * Extractos para la lista editorial de opiniones de la ficha V2 (ronda 2 de JP, C3): las reseñas públicas de
 * Hotmart de ESTE curso, con el nombre legible y la cita sin cortar a media palabra. A diferencia de
 * `resenasPropias`, el mínimo lo pone el panel (`opinionesExtractosMinimo`): cada extracto va rotulado como
 * «Extracto publicado en Hotmart» junto a la nota con todas sus calificaciones, no como «lo que dicen los compradores».
 */
export function extractosDelCurso<T extends ResenaPublica & { id?: string }>(reviews: readonly T[], slug: string, minimo = 1, maximo = MAX_EXTRACTOS): T[] {
  const propias = reviews
    .filter((r) => r.source === 'hotmart-public' && r.slug === slug && r.texto.trim().length >= 12)
    .sort((a, b) => Number(esExtractoEntero(b)) - Number(esExtractoEntero(a)))
    .map((r) => ({ ...r, nombre: nombreLegible(r.nombre), texto: esExtractoEntero(r) ? r.texto.replace(/\s+/g, ' ').trim() : citaSinCortar(r.texto) }));
  return propias.length >= Math.max(1, minimo) ? propias.slice(0, Math.max(1, maximo)) : [];
}

/** Tope de extractos de la lista de opiniones (JP, 26-nov: 3–4); el panel lo puede bajar. */
export const MAX_EXTRACTOS = 4;

/**
 * Extractos de la captura del 26-nov (`scripts/hotmart-opiniones.mjs`, id `hotmart-ask-…`): llegan ya cortados en
 * una frase o palabra completa a partir del texto entero de la evaluación, así que no se vuelven a cortar. Los de la
 * captura del checkout (120 caracteres como mucho) siguen pasando por `citaSinCortar`, y van después.
 */
export const esExtractoEntero = (r: { id?: string }) => typeof r.id === 'string' && r.id.startsWith('hotmart-ask-');
