/**
 * Medición unificada: dataLayer (GTM) + gtag (GA4 directo) + fbq (Meta Pixel).
 * Los IDs se inyectan en BaseLayout según PUBLIC_GTM_ID / PUBLIC_GA4_ID /
 * PUBLIC_META_PIXEL_ID. Taxonomía de eventos del plan de medición Sably.
 */
type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** Eventos propios → evento estándar de Meta (conversiones). */
const META_MAP: Record<string, string> = {
  view_course: 'ViewContent',
  click_cta_hotmart: 'InitiateCheckout',
  submit_lead_form: 'Lead',
  click_whatsapp: 'Contact',
};

export function trackEvent(event: string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer ??= [];
  window.dataLayer.push({ event, ...params });
  window.gtag?.('event', event, params);
  const metaEvent = META_MAP[event];
  if (metaEvent && window.fbq) window.fbq('track', metaEvent, params);
}
