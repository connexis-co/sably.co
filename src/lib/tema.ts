/**
 * Interruptor de tema: `sably-classic` (el de siempre) o `sably-v2` (rediseño).
 *
 * El tema por defecto lo decide un ajuste del sitio (plugin sably-operations,
 * `temaPorDefecto`) y, si nadie lo tocó, la variable de entorno
 * `SABLY_TEMA_POR_DEFECTO`. Sin ninguno de los dos, el clásico: V2 nace apagado.
 *
 * `?tema=v2` y `?tema=clasico` fuerzan uno u otro para revisar. Una página
 * forzada nunca entra en la caché compartida (lleva query, y `canCachePublicPage`
 * rechaza cualquier query), lleva `X-Robots-Tag: noindex` y su canónica es la URL
 * sin parámetros: Google y ChatGPT solo ven la versión por defecto.
 */
export type Tema = 'clasico' | 'v2';

export interface TemaResuelto {
  tema: Tema;
  /** true si la petición pidió un tema con `?tema=`: no se indexa ni se cachea. */
  forzado: boolean;
}

export const PARAMETRO_TEMA = 'tema';
export const CLAVE_AJUSTE_TEMA = 'plugin:sably-operations:settings:temaPorDefecto';

/** Acepta lo que puede escribir una persona: «v2», «V2», «clasico», «clásico», «classic». */
export function normalizarTema(valor: unknown): Tema | null {
  if (typeof valor !== 'string') return null;
  const v = valor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v === 'v2' || v === 'sably-v2') return 'v2';
  if (v === 'clasico' || v === 'classic' || v === 'sably-classic') return 'clasico';
  return null;
}

/** El ajuste del panel gana a la variable de entorno; sin ninguno, el clásico. */
export function temaPorDefecto(ajuste: unknown, entorno: unknown): Tema {
  return normalizarTema(ajuste) ?? normalizarTema(entorno) ?? 'clasico';
}

export function resolverTema(url: URL, porDefecto: Tema): TemaResuelto {
  const pedido = normalizarTema(url.searchParams.get(PARAMETRO_TEMA));
  return pedido ? { tema: pedido, forzado: true } : { tema: porDefecto, forzado: false };
}
