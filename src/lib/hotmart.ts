import { SITE } from './site';

/** Código de afiliado Hotmart (PUBLIC_HOTMART_AFFILIATE). Se agrega a cada checkout. */
const AFFILIATE = import.meta.env.PUBLIC_HOTMART_AFFILIATE ?? '';

interface HotmartUrlParams {
  /** URL base del checkout Hotmart del curso (frontmatter `hotmartUrl`). */
  baseUrl: string;
  coupon?: string;
  courseSlug: string;
  countryCode: string;
  citySlug?: string;
}

/**
 * Construye la URL de checkout Hotmart con cupón + tracking de afiliación.
 * Patrón: ?coupon=SABLY40&src=sably&utm_source=sably.co&utm_medium=web
 *         &utm_campaign=course_{slug}&utm_content={ciudad|país}
 */
export function buildHotmartUrl({
  baseUrl,
  coupon = SITE.defaultCoupon,
  courseSlug,
  countryCode,
  citySlug,
}: HotmartUrlParams): string {
  const url = new URL(baseUrl);
  url.searchParams.set('coupon', coupon);
  url.searchParams.set('src', 'sably');
  url.searchParams.set('utm_source', 'sably.co');
  url.searchParams.set('utm_medium', 'web');
  url.searchParams.set('utm_campaign', `course_${courseSlug}`);
  url.searchParams.set('utm_content', citySlug ?? countryCode);
  if (AFFILIATE) url.searchParams.set('a', AFFILIATE);
  return url.toString();
}

export function buildWhatsAppUrl(whatsapp: string, message: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}
