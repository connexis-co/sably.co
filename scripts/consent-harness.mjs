// Genera una página de prueba con los fragmentos reales del consentimiento y del cargador de GTM (modo gtm).
// Uso: node --import tsx scripts/consent-harness.mjs <salida.html> [gtm|direct] [discreto|completo|pie] [europa|mundo]
import { writeFileSync } from 'node:fs';
import { consentFragments } from '../src/lib/consent/index.ts';
import { trackingFragments } from '../src/plugins/sably-integrations/model.ts';

const [out, mode = 'gtm', notice = 'discreto', region = 'europa'] = process.argv.slice(2);
const config = { browserMode: mode, gtmId: 'GTM-56LHZGMK', gtmDelay: true, ga4Id: 'G-RZF4MSX5B7', metaPixelId: '1711030209407213', serverConversions: false };
const tags = trackingFragments(config, true);
const frags = [...consentFragments(tags.length > 0, { mode: notice, europe: region !== 'mundo' }), ...tags];
const part = (placement) => frags.filter((f) => f.placement === placement).map((f) => (f.kind === 'html' ? f.html : `<script>${f.code}</script>`)).join('\n');
writeFileSync(out, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Banco de consentimiento</title>
${part('head')}</head><body>${part('body:start')}
<main style="font-family:system-ui;padding:24px;min-height:2000px"><h1>Curso de prueba</h1><button id="buy" data-cta-hotmart>Inscribirme</button>
<footer style="margin-top:1800px"><button type="button" data-sably-consent-open>Preferencias de cookies</button></footer></main>
<script>window.dataLayer.push({event:'view_course',course_id:'x'});</script>
<a data-wa-float href="#" style="position:fixed;right:21px;bottom:58px;width:56px;height:56px;border-radius:50%;background:#00e676" aria-label="WhatsApp"></a>
${part('body:end')}</body></html>`);
