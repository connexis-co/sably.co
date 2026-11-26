/**
 * Campos de presentación por artículo (colección `blog`, editor «Presentación»; DISENO.md §5.2 y §12.9). Puro: sin
 * base de datos. Cada campo vacío, ausente o con un valor desconocido vale «heredar» (manda el panel), así que un
 * artículo guardado antes de que existan los campos se ve igual que siempre.
 */
export const CABECERAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j'] as const;
export type Cabecera = (typeof CABECERAS)[number];

export interface PresentacionArticulo {
  /** Cabecera propia del artículo; sin ella, la del panel (`blogCabecera`). */
  cabecera?: Cabecera;
  /** Índice propio: lateral, al inicio del texto o ninguno; sin él, el del panel. */
  indice?: 'lateral' | 'inicio' | 'ninguno';
  /** `ninguna`: ningún hueco de publicidad en este artículo. */
  publicidad?: 'ninguna';
  /** Slug del curso relacionado elegido a mano; sin él, el primero que enlaza el texto. */
  cursoRelacionado?: string;
  /** Fecha de la última revisión del contenido («Actualizado el…» y dateModified). */
  actualizadoEl?: Date;
}

/** Los select de EmDash guardan el texto de la opción («A · Foto a sangre»): vale la letra de delante. */
const letra = <T extends string>(valor: unknown, validos: readonly T[]): T | undefined => {
  if (typeof valor !== 'string') return undefined;
  const l = /^\s*([a-z])(?:\s|·|$)/i.exec(valor)?.[1]?.toLowerCase();
  return l && (validos as readonly string[]).includes(l) ? l as T : undefined;
};

/** Opciones del campo `cabecera` en el editor (la primera = heredar del panel). */
export const OPCIONES_CABECERA = ['Heredar del panel', 'A · Foto a sangre', 'B · Título primero', 'C · Dos columnas', 'D · Mínima, sin foto',
  'E · Editorial, titular grande', 'F · Vídeo protagonista', 'G · Narración protagonista', 'H · Color de la categoría', 'J · Título con el índice al lado'];

export function presentacionDeArticulo(d: Record<string, unknown>): PresentacionArticulo {
  const salida: PresentacionArticulo = {};
  const cabecera = letra(d.cabecera, CABECERAS);
  if (cabecera) salida.cabecera = cabecera;
  const indice = typeof d.indice === 'string' ? d.indice.trim().toLowerCase() : '';
  if (indice === 'lateral') salida.indice = 'lateral';
  else if (indice === 'al inicio') salida.indice = 'inicio';
  else if (indice === 'ninguno') salida.indice = 'ninguno';
  if (typeof d.publicidad === 'string' && /^ninguna/i.test(d.publicidad.trim())) salida.publicidad = 'ninguna';
  const curso = typeof d.curso_relacionado === 'string' ? d.curso_relacionado.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() : '';
  if (curso && /^[a-z0-9-]+$/.test(curso)) salida.cursoRelacionado = curso;
  const fecha = typeof d.actualizado_el === 'string' || d.actualizado_el instanceof Date ? new Date(d.actualizado_el) : null;
  if (fecha && Number.isFinite(fecha.valueOf())) salida.actualizadoEl = fecha;
  return salida;
}

/**
 * Cabecera que se pinta. «Automática» = B con portada propia, D sin ella. Las que necesitan algo que el artículo no
 * tiene caen a una que no lo necesita: sin portada propia, A/B/C/E/J → D (H se queda, sin foto; F y G no la usan
 * para el LCP, pero sin su vídeo o su narración tampoco tienen sentido); F sin vídeo, G sin narración y J sin índice
 * → B (o D sin portada). Nunca se inventa lo que falta.
 */
export function cabeceraElegida(opciones: { panel: string; propia: Cabecera | undefined; conPortada: boolean; conVideo: boolean; conNarracion: boolean; conIndice: boolean }): Cabecera {
  const { panel, propia, conPortada, conVideo, conNarracion, conIndice } = opciones;
  const pedida: Cabecera | 'automatica' = propia ?? ((CABECERAS as readonly string[]).includes(panel) ? panel as Cabecera : 'automatica');
  const base: Cabecera = conPortada ? 'b' : 'd';
  if (pedida === 'automatica') return base;
  if (pedida === 'f') return conVideo ? 'f' : base;
  if (pedida === 'g') return conNarracion ? 'g' : base;
  if (pedida === 'j') return conIndice && conPortada ? 'j' : base;
  if (pedida === 'h' || pedida === 'd') return pedida;
  return conPortada ? pedida : 'd';
}
