/**
 * Formato común del consentimiento (el mismo de academiadebelleza.edu.co, cookie `adb_consent`):
 * «<versión>.<medición 0|1>.<publicidad 0|1>.<unix s>» en la cookie de primera parte `sably_consent`.
 * Es una cookie técnica: recuerda la respuesta y no mide nada. Sin dependencias, para que la lean tanto el
 * navegador (consent/runtime.ts repite esta lógica) como el servidor o las pruebas.
 *
 * Criterio: todo `denied` por defecto en TODAS las regiones (EEE, Reino Unido y Suiza incluidos; en América el
 * criterio de la academia: Ley 1581/2012 y, para quien viene de la UE o EE. UU., el más estricto).
 */
export const CONSENT_COOKIE = 'sably_consent';
/** Sube cuando cambia lo que se pregunta: una respuesta a una versión anterior cuenta como «sin respuesta». */
export const CONSENT_VERSION = 1;
/** 180 días (criterio de la CNIL); luego se vuelve a preguntar. */
export const CONSENT_MAX_AGE_S = 180 * 24 * 60 * 60;

export interface ConsentChoice {
  /** Medición: analytics_storage (GA4, Clarity). */
  analytics: boolean;
  /** Publicidad: ad_storage, ad_user_data, ad_personalization (Google Ads, Meta). */
  ads: boolean;
  version: number;
  /** Momento de la respuesta (segundos Unix). */
  at: number;
}

export function serializeConsent(choice: ConsentChoice): string {
  if (!Number.isSafeInteger(choice.version) || choice.version < 1) throw new Error('Versión de consentimiento inválida.');
  return `${choice.version}.${choice.analytics ? 1 : 0}.${choice.ads ? 1 : 0}.${Math.floor(choice.at)}`;
}

export function parseConsent(value: string | null | undefined): ConsentChoice | null {
  const match = /^(\d{1,4})\.([01])\.([01])\.(\d{1,12})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return { version: Number(match[1]), analytics: match[2] === '1', ads: match[3] === '1', at: Number(match[4]) };
}

/** Elección vigente desde la cabecera `Cookie`; vencida, futura o de otra versión → null. */
export function consentFromCookieHeader(
  header: string | null | undefined,
  options: { now?: Date; minVersion?: number } = {},
): ConsentChoice | null {
  let raw: string | null = null;
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === CONSENT_COOKIE) {
      const value = part.slice(eq + 1).trim();
      try { raw = decodeURIComponent(value); } catch { raw = value; }
      break;
    }
  }
  const choice = parseConsent(raw);
  if (!choice) return null;
  const nowS = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (choice.at > nowS + 300 || nowS - choice.at > CONSENT_MAX_AGE_S) return null;
  if (choice.version < (options.minVersion ?? CONSENT_VERSION)) return null;
  return choice;
}

export type ConsentSignal = 'granted' | 'denied';
const signal = (granted: boolean): ConsentSignal => (granted ? 'granted' : 'denied');

/** `gtag('consent','default', …)`: todo denegado salvo lo necesario; espera 500 ms a la respuesta guardada. */
export function consentModeDefault(): Record<string, string | number> {
  return {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500,
  };
}

export function consentModeUpdate(choice: Pick<ConsentChoice, 'analytics' | 'ads'>): Record<string, ConsentSignal> {
  return {
    ad_storage: signal(choice.ads), ad_user_data: signal(choice.ads),
    ad_personalization: signal(choice.ads), analytics_storage: signal(choice.analytics),
  };
}
