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

/**
 * Tasa que Hotmart aplica entre USD y la moneda local, deducida del propio
 * catálogo capturado: no es una conversión nuestra, es la relación que exhiben
 * la inmensa mayoría de los productos.
 */
const TASA: Record<string, number> = { COP: 3310 };

/** Cuánto puede desviarse un precio local de la tasa antes de no fiarse. */
const TOLERANCIA = 0.05;

/**
 * ¿El precio local cuadra con el USD del mismo producto?
 *
 * Existe porque ya pasó: `curso-de-unas-acrilicas` se publicó a 331.000 COP
 * con 49,99 USD —el doble de lo que cobra el checkout— y `curso-de-limpieza-
 * facial` a 165.450 con 99,99, la mitad. El COP se había quedado viejo mientras
 * el USD se recapturaba, y nadie lo vio porque cada cifra, por separado, es
 * plausible.
 *
 * Anunciar menos de lo que cobra el checkout es lo peor que puede pasar aquí:
 * el comprador llega al pago y ve otro número. Ante la duda se devuelve el USD,
 * que es el que se captura de verdad.
 */
function localFiable(local: number, usd: number, moneda: string): boolean {
  const tasa = TASA[moneda];
  if (!tasa) return true; // sin referencia no se puede juzgar; se respeta
  return Math.abs(local - usd * tasa) / (usd * tasa) <= TOLERANCIA;
}

/** Precio real del checkout para el país, con USD como respaldo. */
export function precioReal(slug: string, country: Country): PrecioReal | null {
  const monedas = PRECIOS[slug];
  if (!monedas) return null;
  const local = monedas[country.currency];
  const usd = monedas.USD;
  if (local && local > 0) {
    if (!usd || usd <= 0 || localFiable(local, usd, country.currency)) {
      return { monto: local, moneda: country.currency, esLocal: true };
    }
    // Incoherente: se cae al USD en vez de publicar un número que no cuadra.
    console.warn(`[precios] ${slug}: ${local} ${country.currency} no cuadra con ${usd} USD`);
  }
  if (usd && usd > 0) return { monto: usd, moneda: 'USD', esLocal: false };
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

export interface Autor {
  nombre: string;
  bio: string;
  /** Ruta local del avatar descargado, o null (se pinta la inicial). */
  foto?: string | null;
  desde: number | null;
  verificado: boolean;
  bestSeller: boolean;
}

const PRODUCTOS = ((datos as Record<string, unknown>).productos ?? {}) as Record<
  string,
  { titulo?: string; autor?: string }
>;
const AUTORES = ((datos as Record<string, unknown>).autores ?? {}) as Record<string, Autor>;

/** Autor real (el productor publicado en Hotmart) del curso, con su slug. */
export function autorDe(slug: string): (Autor & { slug: string }) | null {
  const s = PRODUCTOS[slug]?.autor;
  const a = s ? AUTORES[s] : null;
  return a ? { ...a, slug: s! } : null;
}

/** Todos los creadores, con los slugs de sus cursos. */
export function creadores(): (Autor & { slug: string; cursos: string[] })[] {
  return Object.entries(AUTORES).map(([slug, a]) => ({
    ...a,
    slug,
    cursos: Object.entries(PRODUCTOS)
      .filter(([, p]) => p.autor === slug)
      .map(([c]) => c),
  }));
}

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

/* El formato y la aritmética de cupones viven en `moneda.ts` (sin datos) para
   que los scripts de cliente los importen sin arrastrar este JSON al bundle. */
export { formatMonto, precioConDescuento } from './moneda';
