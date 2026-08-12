import { valoracionMediaCatalogo, valoracionesTotalesCatalogo } from './hotmartLive';

export const SITE = {
  name: 'Sably',
  url: 'https://sably.co',
  tagline: 'Aprende un oficio real. Emprende tu futuro.',
  description:
    'Cursos online de oficios prácticos y habilidades anti-IA para Latinoamérica: panadería, costura, electricidad, barbería, gastronomía y más. Certificado incluido.',
  /**
   * Las promociones NO viven aquí: están en `src/lib/promo.ts`, con ventana de
   * fechas, países y activación por URL. Antes había un `defaultCoupon: 'SABLY40'`
   * inventado que el checkout de Hotmart ignoraba, y un `offerEndsAt` fijo que
   * convertía la oferta en perpetua. Ver la cabecera de promo.ts.
   */
  /**
   * Perfiles REALES de la marca (verificados el 2026-08-12: los tres primeros
   * responden 200). El handle es `sably.cursos` en todas las redes — antes
   * apuntaban a `sably.co`, que no es la cuenta.
   *
   * `youtube` va vacío a propósito: el canal @sably.cursos aún no existe
   * (404). Footer y el `sameAs` del schema filtran los vacíos; cuando JP cree
   * el canal, basta con poner aquí la URL.
   */
  social: {
    instagram: 'https://www.instagram.com/sably.cursos',
    tiktok: 'https://www.tiktok.com/@sably.cursos',
    facebook: 'https://www.facebook.com/sably.cursos',
    youtube: '',
  },
  filiales: [
    {
      name: 'Academia de Belleza',
      url: 'https://academiadebelleza.edu.co',
      description: 'Nuestra academia especializada en belleza y estética',
    },
  ],
  /**
   * Cifras REALES, no de marketing. `rating` y `reviews` se calculan de las
   * valoraciones públicas de los productos en Hotmart (hotmart-live.json, lo
   * refresca el job diario): al recapturar, estas cifras se actualizan solas.
   * Antes decía «15.000+ estudiantes» y «4.8»: números inventados que ninguna
   * fuente respaldaba.
   */
  stats: {
    rating: valoracionMediaCatalogo()?.rating ?? null,
    reviews: valoracionesTotalesCatalogo(),
    courses: 121,
    countries: 8,
  },
} as const;

/** Endpoint de leads: Fase 2 lo sirve el backend Laravel. */
export const LEADS_ENDPOINT = import.meta.env.PUBLIC_LEADS_ENDPOINT ?? '';
/** CDN de assets (Cloudflare R2). Vacío en dev → sirve desde /public. */
export const CDN_URL = import.meta.env.PUBLIC_CDN_URL ?? '';

export const GTM_ID = import.meta.env.PUBLIC_GTM_ID ?? '';
export const GA4_ID = import.meta.env.PUBLIC_GA4_ID ?? '';
export const META_PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID ?? '';
