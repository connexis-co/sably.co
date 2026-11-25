/**
 * Aviso de cookies y centro de preferencias (HTML y CSS; el comportamiento vive en runtime.ts). Diseño: lámina
 * «D · Preferencias sin iniciar sesión» del exporte V2. Es el mismo para el tema clásico y el V2: usa los tokens de
 * global.css (--color-primary, --color-accent, --font-display) con respaldo.
 *
 * Criterios (Ley 1581/2012, RGPD/ePrivacy, WCAG 2.2 AA):
 * - Tres botones del MISMO peso (borde), en el mismo nivel: Rechazar, Configurar y Aceptar. No es un muro.
 * - Preferencias en un <dialog> modal nativo (foco, Esc e `inert` del resto los da el navegador) con interruptores
 *   APAGADOS; las necesarias se explican y no se pueden apagar. Cerrar no decide nada.
 * - `position: fixed` y oculto hasta que el script confirma que no hay respuesta vigente: no empuja el contenido
 *   (CLS 0). En móvil se apila encima de la barra fija (`:has`) para no taparla.
 * - Modo «Discreto»: además, un icono fijo abajo a la izquierda (WhatsApp va a la derecha) que abre las preferencias.
 *   Sube con `translate` (no mueve el diseño) sobre la barra de compra cuando está a la vista, y se esconde mientras
 *   se ve el letrero o la prueba social, que usan esa misma esquina.
 */
import { CONSENT_COOKIE, type ConsentNoticeMode } from './format';

export const POLICY_URL = '/legal/privacidad/#cookies';

const TEXT = {
  region: 'Aviso de cookies',
  title: 'Cookies en Sably',
  body: 'Usamos las necesarias para que el sitio funcione. Con tu permiso, también medimos visitas y anuncios. Puedes cambiarlo cuando quieras en «Preferencias de cookies», al pie de la página.',
  policy: 'Política de privacidad',
  reject: 'Rechazar',
  configure: 'Configurar',
  accept: 'Aceptar',
  prefsTitle: 'Preferencias de cookies',
  prefsIntro: 'Elige cuáles aceptas. Las opcionales vienen apagadas.',
  /** Cuando no hay letrero (modo discreto fuera de Europa) o ya se respondió: los interruptores muestran lo vigente. */
  prefsIntroOn: 'Elige cuáles aceptas. Los interruptores muestran lo que está activo ahora.',
  necessary: 'Necesarias',
  necessaryDesc: 'Hacen funcionar el sitio y recuerdan esta elección. Siempre activas.',
  analytics: 'Medición',
  analyticsDesc: 'Qué páginas y cursos se visitan y de dónde llegas, sin identificarte por tu nombre (Google Analytics y Microsoft Clarity).',
  ads: 'Publicidad',
  adsDesc: 'Medir si nuestros anuncios en Google y Meta terminan en una inscripción y mostrarte anuncios relacionados.',
  hotmart: 'El pago y el acceso al curso son de Hotmart, que usa sus propias cookies.',
  save: 'Guardar selección',
  all: 'Aceptar todas',
  close: 'Cerrar',
  closeNote: 'Cerrar esta ventana no decide nada: el aviso vuelve a aparecer.',
  closeNoteOn: 'Cerrar esta ventana no cambia nada.',
  icon: 'Preferencias de cookies',
  saved: 'Preferencias de cookies guardadas.',
} as const;

const INK = 'var(--color-primary,#1b1b3a)';
const MUTED = 'var(--color-muted,#626b7a)';
const LINE = '#e5e7ee';
const FOCUS = 'var(--color-accent,#c92c52)';

export const CONSENT_CSS = [
  `#sbc,#sbc-dlg{font-family:var(--font-sans,ui-sans-serif,system-ui,sans-serif);color:${INK};font-size:15px;line-height:1.5}`,
  '#sbc p,#sbc-dlg p,#sbc-dlg ul{margin:0}',
  // Tarjeta inferior (escritorio).
  `#sbc{position:fixed;z-index:60;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(27.5rem,calc(100vw - 32px));padding:20px;border:1px solid ${LINE};border-radius:16px;background:#fff;box-shadow:0 18px 44px -14px rgb(27 27 58/.32);display:grid;gap:12px}`,
  '#sbc[hidden]{display:none}',
  `.sbc-t{font-family:var(--font-display,var(--font-sans,system-ui));font-size:1.125rem;font-weight:600;line-height:1.25}`,
  `#sbc .sbc-b{color:${MUTED};font-size:14px}`,
  `#sbc a,#sbc-dlg a{color:${INK};font-weight:600;text-decoration:underline;text-underline-offset:.18em}`,
  '.sbc-act{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
  `.sbc-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 12px;border:1.5px solid ${INK};border-radius:999px;background:#fff;color:${INK};font:inherit;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer}`,
  '.sbc-btn:hover{background:#f4f5f9}',
  `.sbc-btn--solid{background:${INK};color:#fff}.sbc-btn--solid:hover{background:var(--color-primary-soft,#2a2a52)}`,
  `.sbc-btn:focus-visible,.sbc-x:focus-visible,#sbc a:focus-visible,#sbc-dlg a:focus-visible,.sbc-sw:focus-visible{outline:3px solid ${FOCUS};outline-offset:2px}`,
  // Diálogo de preferencias.
  `#sbc-dlg{width:min(30rem,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);margin:auto;padding:0;border:0;border-radius:24px;background:#fff;box-shadow:0 28px 70px -20px rgb(13 20 31/.5);overflow:auto}`,
  '#sbc-dlg::backdrop{background:rgb(13 20 31/.55)}',
  '.sbc-in{display:grid;gap:4px;padding:28px 32px 28px}',
  '.sbc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}',
  `#sbc-dlg .sbc-h{font-family:var(--font-display,var(--font-sans,system-ui));font-size:1.5rem;font-weight:600;line-height:1.2}`,
  `.sbc-x{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:-8px -10px 0 0;border:0;border-radius:999px;background:transparent;color:${INK};cursor:pointer}.sbc-x:hover{background:#f4f5f9}.sbc-x svg{width:22px;height:22px}`,
  `#sbc-dlg .sbc-i{color:${MUTED};font-size:16px}`,
  '#sbc-dlg ul{list-style:none;padding:0;margin-top:8px}',
  `.sbc-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 20px;padding:16px 0;border-bottom:1px solid ${LINE}}`,
  `.sbc-n{display:block;font-size:16px;font-weight:600}label.sbc-n{cursor:pointer}`,
  `#sbc-dlg .sbc-d{color:${MUTED};font-size:14px}`,
  // Interruptor: casilla nativa con aspecto de interruptor; viene apagada.
  `.sbc-sw{appearance:none;width:44px;height:26px;margin:0;border-radius:999px;background:#c9ccdb;position:relative;cursor:pointer;transition:background-color .15s}`,
  '.sbc-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.3);transition:translate .15s}',
  `.sbc-sw:checked{background:${INK}}.sbc-sw:checked::after{translate:18px 0}`,
  `.sbc-lock{display:grid;place-items:center;width:44px;height:26px;border-radius:999px;background:#e5e7ee;color:${MUTED}}.sbc-lock svg{width:14px;height:14px}`,
  '.sbc-hot{margin-top:12px}',
  '.sbc-save{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.sbc-save .sbc-btn{flex:1 1 9rem;padding:0 20px}',
  `#sbc-dlg .sbc-note{margin-top:8px;color:${MUTED};font-size:13px}`,
  '.sbc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
  // Móvil: hoja compacta pegada al borde, por encima de la barra fija (V2 mide 72 px; en el clásico, --barra-alto).
  '@media (max-width:39.99rem){#sbc{left:8px;right:8px;width:auto;bottom:calc(8px + env(safe-area-inset-bottom,0px));padding:14px 14px 12px;gap:8px;border-radius:16px}.sbc-t{font-size:1rem}#sbc .sbc-b{font-size:13px;line-height:1.4}.sbc-btn{min-height:44px;padding:0 6px;font-size:14px}.sbc-in{padding:20px 20px 24px}}',
  // Sube con `translate` y no con `bottom`: mover `bottom` cuenta como desplazamiento de diseño (CLS).
  '@media (max-width:63.99rem){body:has([data-barra-fija]:not([data-oculta])) #sbc{translate:0 -72px}}',
  'body:has([data-sticky-cta]:not([data-oculta])) #sbc{translate:0 calc(-1 * var(--barra-alto,57px))}',
  // Entrada: opacidad y un desplazamiento corto, solo sin «reducir movimiento».
  '@media (prefers-reduced-motion:no-preference){#sbc{transition:opacity .25s cubic-bezier(.2,.8,.2,1),translate .25s cubic-bezier(.2,.8,.2,1),display .25s allow-discrete}#sbc[hidden]{opacity:0;translate:0 12px}@starting-style{#sbc{opacity:0;translate:0 12px}}}',
  '@media (forced-colors:active){#sbc,#sbc-dlg{border:1px solid CanvasText}.sbc-btn,.sbc-sw{border:1.5px solid ButtonText}}',
].join('');

/** Icono del modo discreto. Esquina inferior izquierda; sube con `translate` sobre las barras de compra (sin CLS). */
export const CONSENT_ICON_CSS = [
  `#sbc-ico{position:fixed;z-index:41;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));display:grid;place-items:center;width:40px;height:40px;padding:0;border:1px solid ${LINE};border-radius:999px;background:#fff;color:${INK};box-shadow:0 6px 16px -8px rgb(27 27 58/.4);cursor:pointer}`,
  '#sbc-ico:hover{background:#f4f5f9}#sbc-ico svg{width:20px;height:20px}',
  `#sbc-ico:focus-visible{outline:3px solid ${FOCUS};outline-offset:2px}`,
  '#sbc:not([hidden])~#sbc-ico,body:has([data-prueba-social]:not([hidden])) #sbc-ico{visibility:hidden;opacity:0}',
  // Si el panel de WhatsApp lo pone a la izquierda, el icono se va a la derecha.
  'body:has(#sably-whatsapp[style*="left"]) #sbc-ico{left:auto;right:16px}',
  '@media (max-width:63.99rem){body:has([data-barra-fija]:not([data-oculta])) #sbc-ico{translate:0 -72px}}',
  'body:has([data-sticky-cta]:not([data-oculta])) #sbc-ico{translate:0 calc(-1 * var(--barra-alto,57px))}',
  '@media (prefers-reduced-motion:no-preference){#sbc-ico{transition:translate .2s cubic-bezier(.2,.8,.2,1),opacity .2s,visibility .2s}}',
  '@media (forced-colors:active){#sbc-ico{border:1px solid ButtonText}}',
  '@media print{#sbc-ico{display:none}}',
].join('');

/** Galleta de lucide (licencia ISC, la misma familia de iconos del sitio). */
const COOKIE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/></svg>';

const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

/**
 * HTML del aviso (oculto hasta que el script confirme que le toca y no hay respuesta vigente), del diálogo y, en modo
 * discreto, del icono. Los textos con `data-sbc-off`/`data-sbc-on` los cambia el script según los interruptores
 * vengan apagados (letrero) o muestren lo vigente.
 */
export function consentBannerHtml(mode: ConsentNoticeMode = 'discreto'): string {
  const t = TEXT;
  const link = `<a href="${POLICY_URL}">${t.policy}</a>`;
  return [
    `<style>${CONSENT_CSS}</style>`,
    `<section id="sbc" aria-label="${t.region}" data-consent-cookie="${CONSENT_COOKIE}" hidden>`,
    `<p class="sbc-t">${t.title}</p><p class="sbc-b">${t.body} ${link}.</p>`,
    '<div class="sbc-act">',
    `<button type="button" class="sbc-btn" data-sbc="reject">${t.reject}</button>`,
    `<button type="button" class="sbc-btn" data-sbc="prefs" aria-haspopup="dialog">${t.configure}</button>`,
    `<button type="button" class="sbc-btn" data-sbc="accept">${t.accept}</button>`,
    '</div></section>',
    `<dialog id="sbc-dlg" aria-labelledby="sbc-dlg-t" closedby="any"><div class="sbc-in">`,
    `<div class="sbc-top"><p id="sbc-dlg-t" class="sbc-h">${t.prefsTitle}</p><button type="button" class="sbc-x" data-sbc="close" aria-label="${t.close}">${CROSS}</button></div>`,
    `<p class="sbc-i"><span data-sbc-off="${t.prefsIntro}" data-sbc-on="${t.prefsIntroOn}">${t.prefsIntro}</span> ${link}.</p><ul>`,
    `<li class="sbc-row"><div><p class="sbc-n">${t.necessary}</p><p class="sbc-d">${t.necessaryDesc}</p></div><span class="sbc-lock" aria-hidden="true">${LOCK}</span></li>`,
    `<li class="sbc-row"><div><label for="sbc-a" class="sbc-n">${t.analytics}</label><p id="sbc-a-d" class="sbc-d">${t.analyticsDesc}</p></div><input type="checkbox" role="switch" id="sbc-a" class="sbc-sw" aria-describedby="sbc-a-d"></li>`,
    `<li class="sbc-row"><div><label for="sbc-m" class="sbc-n">${t.ads}</label><p id="sbc-m-d" class="sbc-d">${t.adsDesc}</p></div><input type="checkbox" role="switch" id="sbc-m" class="sbc-sw" aria-describedby="sbc-m-d"></li>`,
    `</ul><p class="sbc-d sbc-hot">${t.hotmart}</p>`,
    `<div class="sbc-save"><button type="button" class="sbc-btn sbc-btn--solid" data-sbc="save">${t.save}</button><button type="button" class="sbc-btn" data-sbc="all">${t.all}</button></div>`,
    `<p class="sbc-note" data-sbc-off="${t.closeNote}" data-sbc-on="${t.closeNoteOn}">${t.closeNote}</p></div></dialog>`,
    `<p id="sbc-live" class="sbc-sr" role="status" data-msg="${t.saved}"></p>`,
    ...(mode === 'discreto'
      ? [`<style>${CONSENT_ICON_CSS}</style>`, `<button type="button" id="sbc-ico" data-sably-consent-open aria-haspopup="dialog" aria-label="${t.icon}" title="${t.icon}">${COOKIE}</button>`]
      : []),
  ].join('');
}
