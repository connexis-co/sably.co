/** Pequeñas reglas de presentación del tema V2, compartidas por la ficha y la caja. */

/**
 * Solo fotos servidas por Sably. Las de Hotmart en S3 que guarda el CMS
 * responden 403 (comprobado el 25-nov-2026 con la de MasterClasses.La): una
 * imagen rota junto al nombre de quien dicta el curso resta confianza, así que
 * sin foto propia se pintan las iniciales.
 */
export function fotoPropia(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try { return new URL(url).hostname === 'sably.co'; } catch { return false; }
}

/** «MasterClasses.La®» → «MC»; «Mauricio Duque Zuluaga» → «MD». */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const mayusculas = (palabras[0] ?? '').match(/\p{Lu}/gu) ?? [];
  if (mayusculas.length >= 2) return mayusculas.slice(0, 2).join('');
  const letras = palabras.map(p => p.match(/\p{L}/u)?.[0] ?? '').filter(Boolean);
  return (letras.length >= 2 ? letras[0]! + letras[1]! : (palabras[0] ?? '').slice(0, 2)).toUpperCase();
}

/** «95.506» o «586,96»: la cifra sin símbolo; la moneda (COP, MXN…) va aparte, más pequeña. */
export function cifra(valor: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: Number.isInteger(valor) ? 0 : 2, maximumFractionDigits: 2 }).format(valor);
}

/** Monedas que Hotmart cobra sin decimales. El resto, siempre con dos. */
const SIN_DECIMALES = new Set(['COP', 'CLP']);
/** Moneda propia de cada configuración regional: con ella basta el símbolo corto («$»). */
const MONEDA_PROPIA: Record<string, string> = { 'es-CO': 'COP', 'es-MX': 'MXN', 'es-PE': 'PEN', 'es-EC': 'USD', 'es-CL': 'CLP', 'es-AR': 'ARS', 'es-ES': 'EUR', 'es-US': 'USD', 'en-US': 'USD' };

export interface Importe {
  /** «$», «S/», «€». */
  simbolo: string;
  /** «$ 191.012», «49,99 €»: símbolo en el lado que usa el país y cifra con su formato. */
  visible: string;
  /** «COP»: va aparte, más pequeño y con menos peso. */
  codigo: string;
  /** «$ 191.012 COP»: para textos corridos y atributos (botón, «Después vuelve a…»). */
  texto: string;
  /** «191.012 pesos colombianos»: lo que dice el lector de pantalla, una sola vez. */
  hablado: string;
}

/**
 * Formato único de precios del tema V2 (caja, barra fija, botón, cierre y tarjetas): símbolo
 * delante (o detrás, como en España) + importe con los separadores del país + código ISO.
 * Los separadores y el símbolo los decide `Intl.NumberFormat` con la configuración regional
 * del país (`country.hreflang`); aquí solo se ordenan las piezas y se fija el espacio.
 */
export function importe(valor: number, moneda: string, locale: string): Importe {
  const digitos = SIN_DECIMALES.has(moneda) ? 0 : 2;
  const base = { style: 'currency', currency: moneda, minimumFractionDigits: digitos, maximumFractionDigits: digitos } as const;
  // Una moneda ajena al país (dólares en la vista de España) lleva el símbolo largo: «US$».
  const display = MONEDA_PROPIA[locale] === moneda ? 'narrowSymbol' : 'symbol';
  const partes = new Intl.NumberFormat(locale, { ...base, currencyDisplay: display }).formatToParts(Math.abs(valor));
  const posSimbolo = partes.findIndex(p => p.type === 'currency');
  const simbolo = partes[posSimbolo]?.value ?? moneda;
  const cifraTexto = partes.filter(p => p.type === 'integer' || p.type === 'group' || p.type === 'decimal' || p.type === 'fraction').map(p => p.value).join('');
  const detras = posSimbolo > partes.findIndex(p => p.type === 'integer');
  const signo = valor < 0 ? '−' : '';
  const visible = signo + (detras ? `${cifraTexto} ${simbolo}` : `${simbolo} ${cifraTexto}`);
  const hablado = (valor < 0 ? 'menos ' : '') + new Intl.NumberFormat(locale, { ...base, currencyDisplay: 'name' }).format(Math.abs(valor));
  return { simbolo, visible, codigo: moneda, texto: `${visible} ${moneda}`, hablado };
}
