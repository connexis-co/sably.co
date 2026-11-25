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
