import type { PromoCampaign } from './promo';

interface HotmartUrlParams {
  /** URL base del checkout Hotmart del curso (frontmatter `hotmartUrl`). */
  baseUrl: string;
  /**
   * Código de referencia del afiliado para ESTE producto (frontmatter `hotmartRef`).
   *
   * Es lo que acredita la comisión. Hotmart lo emite por producto (no es global):
   * `hotm.art/decoracion-unas-curso-crashing` → `pay.hotmart.com/P58716037X?ref=J76206210L`.
   * Sin `ref`, el checkout funciona igual pero la venta se acredita al productor y
   * nosotros no cobramos nada. Verificado el 2026-08-10.
   */
  ref?: string;
  /** Campaña vigente, si la hay. Sin campaña no se manda ningún descuento. */
  promo?: PromoCampaign | null;
  /**
   * `false` si el checkout de este creador no acepta el cupón del sitio: el
   * precio elegido ya viaja dentro de su acortador. Añadir `offDiscount` ahí
   * no abarata nada y puede invalidar la oferta que el enlace ya trae.
   */
  aceptaCupon?: boolean;
  courseSlug: string;
  countryCode: string;
  citySlug?: string;
}

/**
 * Construye la URL de checkout Hotmart con atribución de afiliado y tracking.
 *
 * Patrón: ?ref=<afiliado>&offDiscount=<cupón>&src=sably&utm_*
 *
 * Nota sobre `offDiscount`: es el parámetro real que Hotmart interpreta como cupón
 * (NO `coupon`, que el checkout ignora). Verificado contra P58716037X el 2026-08-10:
 * 165.752 COP sin el parámetro → 82.876 COP con `?offDiscount=031016`, y el checkout
 * responde «¡Has recibido un cupón de 50%!».
 */
export function buildHotmartUrl({
  baseUrl,
  ref,
  promo,
  aceptaCupon = true,
  courseSlug,
  countryCode,
  citySlug,
}: HotmartUrlParams): string {
  const url = new URL(baseUrl);
  if (ref) url.searchParams.set('ref', ref);
  if (promo && aceptaCupon) url.searchParams.set('offDiscount', promo.couponCode);
  url.searchParams.set('src', 'sably');
  url.searchParams.set('utm_source', 'sably.co');
  url.searchParams.set('utm_medium', 'web');
  url.searchParams.set('utm_campaign', `course_${courseSlug}`);
  url.searchParams.set('utm_content', citySlug ?? countryCode);
  return url.toString();
}

/** `true` si la URL ya lleva atribución de afiliado. Se usa para auditar el catálogo. */
export function tieneAtribucion(url: string): boolean {
  try {
    return new URL(url).searchParams.has('ref');
  } catch {
    return false;
  }
}

export function buildWhatsAppUrl(whatsapp: string, message: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}
