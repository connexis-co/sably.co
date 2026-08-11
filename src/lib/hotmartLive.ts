/**
 * Acceso a los datos vivos de Hotmart horneados en el build.
 *
 * `src/data/hotmart-live.json` lo escribe `scripts/hotmart-precios.mjs` (job
 * diario + captura por visitante vía /api/v1/precios/refresca). Contiene el
 * precio real del checkout por moneda y la valoración pública real de cada
 * producto. Si un curso no aparece, la regla es NO inventar: se cae al precio
 * de catálogo y no se pintan estrellas.
 */
import datos from '@/data/hotmart-live.json';
import type { Country } from './countries';

interface Valoracion {
  rating: number;
  total: number;
}

export interface Resena {
  /** Nombre que el autor publicó junto a su reseña en Hotmart. */
  nombre: string;
  rating: number;
  texto?: string;
}

const PRECIOS = datos.precios as Record<string, Record<string, number>>;
const VALORACIONES = datos.valoraciones as Record<string, Valoracion>;
const RESENAS = ((datos as Record<string, unknown>).resenas ?? {}) as Record<string, Resena[]>;

export interface PrecioReal {
  monto: number;
  moneda: string;
  /** false = no hay precio en la moneda del país y se responde el base USD. */
  esLocal: boolean;
}

/** Precio real del checkout para el país, con USD como respaldo. */
export function precioReal(slug: string, country: Country): PrecioReal | null {
  const monedas = PRECIOS[slug];
  if (!monedas) return null;
  const local = monedas[country.currency];
  if (local && local > 0) return { monto: local, moneda: country.currency, esLocal: true };
  if (monedas.USD && monedas.USD > 0) return { monto: monedas.USD, moneda: 'USD', esLocal: false };
  return null;
}

/** Valoración pública real del producto en Hotmart, o null si no consta. */
export function valoracionReal(slug: string): Valoracion | null {
  const v = VALORACIONES[slug];
  return v && v.total > 0 && v.rating >= 1 ? v : null;
}

/** Nota media real de todo el catálogo, para las afirmaciones de sitio. */
export function valoracionMediaCatalogo(): { rating: number; cursos: number } | null {
  const vs = Object.values(VALORACIONES).filter((v) => v.total > 0);
  if (!vs.length) return null;
  const media = vs.reduce((s, v) => s + v.rating, 0) / vs.length;
  return { rating: Math.round(media * 10) / 10, cursos: vs.length };
}

/** Valoraciones reales acumuladas en todo el catálogo (suma de Hotmart). */
export function valoracionesTotalesCatalogo(): number {
  return Object.values(VALORACIONES).reduce((s, v) => s + v.total, 0);
}

const PRODUCTOS = ((datos as Record<string, unknown>).productos ?? {}) as Record<
  string,
  { titulo?: string }
>;

/** Título del curso tal y como se publica, para nombrarlo en avisos. */
export function tituloDe(slug: string): string | null {
  return PRODUCTOS[slug]?.titulo ?? null;
}

/** Reseñas públicas con nombre de un curso concreto. */
export function resenasReales(slug: string): Resena[] {
  return RESENAS[slug] ?? [];
}

/** Una reseña con nombre por curso, para rotar avisos por todo el catálogo. */
export function resenasDelCatalogo(): { slug: string; resena: Resena }[] {
  return Object.entries(RESENAS)
    .map(([slug, rs]) => ({ slug, resena: rs[0]! }))
    .filter((x) => x.resena);
}

/**
 * Formatea un monto en su moneda con el estilo de la casa: `$165.450 COP`,
 * `US$49,99`. Sin conversiones: el número que se enseña es el que cobra el
 * checkout en esa moneda.
 */
export function formatMonto(monto: number, moneda: string): string {
  const decimales = Number.isInteger(monto) ? 0 : 2;
  const n = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(monto);
  return moneda === 'USD' ? `US$${n}` : `$${n} ${moneda}`;
}
