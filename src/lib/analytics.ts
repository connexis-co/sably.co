/**
 * Medición unificada: dataLayer (GTM) + gtag (GA4 directo) + fbq (Meta Pixel).
 * Los IDs se configuran en Sably · integraciones mediante los hooks de EmDash. Taxonomía de eventos del plan de medición Sably.
 */
type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    sablyTrackingMode?: 'gtm' | 'direct';
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    oaiq?: (...args: unknown[]) => void;
  }
}

/** Eventos propios → evento estándar de Meta (conversiones). */
const META_MAP: Record<string, string> = {
  view_course: 'ViewContent',
  click_cta_hotmart: 'InitiateCheckout',
  submit_lead_form: 'Lead',
  click_whatsapp: 'Contact',
};

/**
 * Prueba A/B del héroe de la portada (HEROES-X §11): si el visitante tiene variante asignada (cookie
 * `sably_ab_heroe` = «inicio|variante», la pone la portada), todos sus eventos llevan experiment_id y variant_id.
 */
export function varianteHeroeAB(): { experiment_id: string; variant_id: string } | null {
  try {
    const m = document.cookie.match(/(?:^|; )sably_ab_heroe=([^;]*)/);
    const v = m ? decodeURIComponent(m[1]!).split('|')[1] : undefined;
    return v && /^[a-z0-9]{2,12}$/.test(v) ? { experiment_id: 'heroe_portada', variant_id: v } : null;
  } catch { return null; }
}

/**
 * Eventos propios → evento estándar del píxel de ChatGPT Ads (`oaiq`, lo instala Sably · integraciones). La compra
 * (order_created) no sale del navegador: se cierra en Hotmart y la envía el webhook por la Conversions API.
 */
function openaiMeasure(event: string, params: EventParams): void {
  const oaiq = window.oaiq;
  if (!oaiq) return;
  const id = String(params.course_slug ?? params.page ?? location.pathname);
  if (event === 'click_cta_hotmart') oaiq('measure', 'checkout_started', { type: 'contents', contents: [{ id, content_type: 'product' }] });
  else if (event === 'view_course') oaiq('measure', 'contents_viewed', { type: 'contents', contents: [{ id, content_type: 'product' }] });
  else if (event === 'submit_lead_form') oaiq('measure', 'lead_created', { type: 'customer_action' });
}

export function trackEvent(event: string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  const ab = varianteHeroeAB();
  if (ab) params = { ...ab, ...params };
  window.dataLayer ??= [];
  window.dataLayer.push({ event, ...params });
  try { openaiMeasure(event, params); } catch { /* el píxel nunca rompe la página */ }
  if (window.sablyTrackingMode !== 'direct') return;
  window.gtag?.('event', event, params);
  const metaEvent = META_MAP[event];
  if (metaEvent && window.fbq) window.fbq('track', metaEvent, params);
}
