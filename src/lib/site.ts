export const SITE = {
  name: 'Sably',
  url: 'https://sably.co',
  tagline: 'Aprende un oficio real. Emprende tu futuro.',
  description:
    'Cursos online de oficios prácticos y habilidades anti-IA para Latinoamérica: panadería, costura, electricidad, barbería, gastronomía y más. Certificado incluido.',
  defaultCoupon: 'SABLY40',
  couponDiscountPct: 40,
  /** TODO(JP): actualizar cada vez que rote la campaña. Fase 2: vendrá de la Hotmart Coupons API. */
  offerEndsAt: '2026-08-31T23:59:59-05:00',
  social: {
    instagram: 'https://instagram.com/sably.co',
    tiktok: 'https://tiktok.com/@sably.co',
    facebook: 'https://facebook.com/sably.co',
    youtube: 'https://youtube.com/@sably-co',
  },
  filiales: [
    {
      name: 'Academia de Belleza',
      url: 'https://academiadebelleza.edu.co',
      description: 'Nuestra academia especializada en belleza y estética',
    },
  ],
  stats: {
    students: '15.000+',
    rating: 4.8,
    courses: 105,
    countries: 7,
  },
} as const;

/** Endpoint de leads: Fase 2 lo sirve el backend Laravel. */
export const LEADS_ENDPOINT = import.meta.env.PUBLIC_LEADS_ENDPOINT ?? '';
export const GTM_ID = import.meta.env.PUBLIC_GTM_ID ?? '';
export const GA4_ID = import.meta.env.PUBLIC_GA4_ID ?? '';
export const META_PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID ?? '';
