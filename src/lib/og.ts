/**
 * Imagen para compartir (Open Graph y Twitter) de cada página.
 *
 * Las imágenes de las páginas principales son estáticas, con la versión en el
 * nombre (/og/portada-co.v1.jpg) para que WhatsApp, Facebook, X y LinkedIn no
 * reutilicen la copia guardada de la URL anterior. Se generan con
 * scripts/og-generar.mjs desde src/lib/og-imagenes.json (misma fuente de verdad).
 * Las fichas y los artículos usan su imagen destacada del CMS; si no tienen una
 * apta, la de su categoría o la del blog.
 *
 * Orden de prioridad en Base.astro: SEO propio de la entrada en el CMS >
 * imagen destacada de la ficha o el artículo > imagen de la página principal >
 * imagen global del panel (Ajustes → SEO) > la genérica de Sably.
 */
import catalogo from './og-imagenes.json';
import { cmsImageUrl } from './cms-media';

export interface OgImagen {
  /** Ruta relativa o URL absoluta. */
  url: string;
  /** Solo si se conocen de verdad (estáticos propios o dimensiones guardadas en el medio del CMS). */
  ancho?: number;
  alto?: number;
  tipo?: string;
  alt: string;
}

const imagenes = new Map(catalogo.imagenes.map((i) => [i.id, i]));

/** Imagen estática de /og/ por id («portada-co», «categoria-oficios», «nosotros»…). */
export function ogEstatica(id: string): OgImagen | undefined {
  const i = imagenes.get(id);
  return i ? { url: `/og/${id}.v${catalogo.version}.jpg`, ancho: 1200, alto: 630, tipo: 'image/jpeg', alt: i.alt } : undefined;
}

export const ogGenerica = (): OgImagen => ogEstatica('sably')!;

/** Imagen de una categoría; la genérica si el slug no tiene la suya. */
export const ogCategoria = (slug: string): OgImagen => ogEstatica(`categoria-${slug}`) ?? ogGenerica();

/**
 * Imagen de las páginas que no llevan foto propia, por tipo de página.
 * Devuelve `undefined` para las que no tienen una específica (las cubre el ajuste global del panel o la genérica).
 */
export function ogPorPagina(pageType: string, countryCode: string, pathname: string): OgImagen | undefined {
  switch (pageType) {
    case 'home': return ogEstatica(`portada-${countryCode}`);
    case 'catalog': return ogEstatica('cursos');
    case 'category': return ogEstatica(`categoria-${pathname.match(/^\/[a-z]{2}\/cursos\/([^/]+)\/?$/)?.[1] ?? ''}`);
    case 'blog': return ogEstatica('blog');
    case 'homologaciones': case 'homologacion_programa': return ogEstatica('homologaciones');
    case 'video_library': return ogEstatica('videos');
    case 'page':
      if (pathname.startsWith('/nosotros')) return ogEstatica('nosotros');
      if (pathname.startsWith('/contacto')) return ogEstatica('contacto');
      if (pathname.startsWith('/legal')) return ogEstatica('legal');
      return undefined;
    default: return undefined;
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' };
const tipoPorExtension = (url: string) => TIPOS[(url.split('?')[0] ?? '').split('.').pop()?.toLowerCase() ?? ''];

/**
 * Una foto del CMS es apta para compartir si no es una de las antiguas de la
 * migración (800×536, nombre de 64 hex o carpeta migration/; las nuevas tienen
 * id ULID) ni mide menos de 1200 px de ancho cuando se conoce.
 */
export function esFotoAntigua(url: string, ancho?: number): boolean {
  return (ancho !== undefined && ancho < 1200) || /\/migration\/|[0-9a-f]{64}/.test(url);
}

/** Imagen destacada del CMS como OgImagen; `undefined` si no hay o es de las antiguas. */
export function ogDeCms(valor: unknown, altPorDefecto: string): OgImagen | undefined {
  const url = cmsImageUrl(valor);
  if (!url) return undefined;
  const m = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>;
  const ancho = num(m.width), alto = num(m.height);
  if (esFotoAntigua(url, ancho)) return undefined;
  const alt = typeof m.alt === 'string' && m.alt.trim() ? m.alt.trim() : altPorDefecto;
  const tipo = typeof m.mimeType === 'string' && m.mimeType.startsWith('image/') ? m.mimeType : tipoPorExtension(url);
  return { url, ...(ancho && alto ? { ancho, alto } : {}), ...(tipo ? { tipo } : {}), alt };
}
