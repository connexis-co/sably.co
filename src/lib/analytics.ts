/**
 * Helper de eventos GA4 vía dataLayer (GTM).
 * Los nombres de evento siguen la taxonomía definida en el plan de medición Sably.
 */
type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function trackEvent(event: string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer ??= [];
  window.dataLayer.push({ event, ...params });
}
