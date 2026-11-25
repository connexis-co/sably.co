import type { PageFragmentContribution } from 'emdash';
import { consentBannerHtml } from './banner';
import { consentRuntimeScript } from './runtime';

export * from './format';
export { POLICY_URL } from './banner';

/**
 * Fragmentos del consentimiento. Van PRIMERO en la lista del hook para que el `consent default` quede antes que
 * cualquier etiqueta. `tags`: la página lleva etiquetas de terceros (producción); sin ellas solo se pinta el aviso
 * (y así se puede revisar en staging).
 */
export function consentFragments(tags: boolean): PageFragmentContribution[] {
  return [
    { kind: 'inline-script', placement: 'head', key: 'sably-consent', code: consentRuntimeScript(tags) },
    { kind: 'html', placement: 'body:start', key: 'sably-consent-banner', html: consentBannerHtml() },
  ];
}
