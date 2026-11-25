import type { PageFragmentContribution } from 'emdash';
import { consentBannerHtml } from './banner';
import { consentRuntimeScript } from './runtime';
import { CONSENT_OPTIONS_DEFAULT, type ConsentOptions } from './format';

export * from './format';
export { POLICY_URL } from './banner';

/**
 * Fragmentos del consentimiento. Van PRIMERO en la lista del hook para que el `consent default` quede antes que
 * cualquier etiqueta. `tags`: la página lleva etiquetas de terceros (producción); sin ellas solo se pinta el aviso
 * (y así se puede revisar en staging). El aviso va al final del <body>: es `position: fixed` y su interfaz arranca
 * en DOMContentLoaded, y así su H2 «Preferencias de cookies» no queda antes del H1 de la página.
 * `options`: modo del aviso y excepción europea, elegidos en el panel (sably-integrations).
 */
export function consentFragments(tags: boolean, options: ConsentOptions = CONSENT_OPTIONS_DEFAULT): PageFragmentContribution[] {
  return [
    { kind: 'inline-script', placement: 'head', key: 'sably-consent', code: consentRuntimeScript(tags, options) },
    { kind: 'html', placement: 'body:end', key: 'sably-consent-banner', html: consentBannerHtml(options.mode) },
  ];
}
