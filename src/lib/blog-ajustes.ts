/**
 * Ajustes del blog V2 ya resueltos: cada clave `blog*` guardada en el panel, o su valor de fábrica si falta o no es
 * válido. Puro (sin base de datos) para poder probarlo; lo llama `leerAjustesV2`.
 */
import { BLOG_SETTINGS, type ClaveBlog } from '../plugins/sably-operations/ajustes-blog';

type Campo = (typeof BLOG_SETTINGS)[ClaveBlog];
type Valor<K extends ClaveBlog> = (typeof BLOG_SETTINGS)[K] extends { type: 'select'; options: { value: infer V }[] } ? V
  : (typeof BLOG_SETTINGS)[K] extends { type: 'boolean' } ? boolean : string;
export type AjustesBlog = { [K in ClaveBlog]: Valor<K> };

const REDES = ['whatsapp', 'facebook', 'x', 'linkedin', 'correo', 'copiar'] as const;
const POSICIONES = ['metadatos', 'carril', 'final'] as const;
export type Red = (typeof REDES)[number];
export type PosicionCompartir = (typeof POSICIONES)[number];

/** Lista separada por comas → solo los valores conocidos, sin repetir y en el orden escrito. */
export function listaConocida<T extends string>(texto: string, validos: readonly T[]): T[] {
  return [...new Set(texto.split(',').map(s => s.trim().toLowerCase()).filter((s): s is T => (validos as readonly string[]).includes(s)))];
}

export function leerAjustesBlog(v: Record<string, unknown>): AjustesBlog {
  const salida: Record<string, unknown> = {};
  for (const [clave, campo] of Object.entries(BLOG_SETTINGS) as [ClaveBlog, Campo][]) {
    const valor = v[clave];
    if (campo.type === 'boolean') salida[clave] = typeof valor === 'boolean' ? valor : campo.default;
    else if (campo.type === 'select') salida[clave] = typeof valor === 'string' && campo.options.some(o => o.value === valor) ? valor : campo.default;
    else salida[clave] = typeof valor === 'string' ? valor.trim() : campo.default;
  }
  return salida as AjustesBlog;
}

export const redesCompartir = (a: AjustesBlog): Red[] => listaConocida(a.blogCompartirRedes, REDES);
export const posicionesCompartir = (a: AjustesBlog): PosicionCompartir[] => listaConocida(a.blogCompartirPosiciones, POSICIONES);
