import type { PageFragmentContribution, SettingField, SettingsAccess } from 'emdash';
import type { LegacyBindings } from '../../lib/legacy-backend';
import { operationalEnvironmentEnabled } from '../../lib/operational-environment';
import { CONSENT_NOTICE_MODES, CONSENT_OPTIONS_DEFAULT, type ConsentNoticeMode, type ConsentOptions } from '../../lib/consent/format';

export const settingsSchema = {
  // Rótulos con el grupo delante y ayuda en cada campo. Las claves son contrato (options `plugin:sably-integrations:settings:<clave>`).
  browserMode: { type: 'select', label: 'Medición · Cómo se instala', description: 'Mejor editarlo en «Medición y conversiones», que valida los IDs. Por defecto: Desactivada.', default: 'off', options: [{value:'off',label:'Desactivada'},{value:'gtm',label:'Google Tag Manager'},{value:'direct',label:'GA4 y Meta directamente'}] },
  gtmId: { type:'string',label:'Medición · ID del contenedor de Tag Manager',description:'Formato GTM-XXXXXXX. Pega solo el ID, sin código HTML. Por defecto: vacío.',default:'' },
  gtmDelay: { type:'boolean',label:'Medición · Cargar Tag Manager después de la página',description:'Recomendado: la web se ve antes en móvil y los eventos previos se envían igual. Por defecto: encendido.',default:true },
  ga4Id: { type:'string',label:'Medición · ID de medición de GA4',description:'Formato G-XXXXXXX. También identifica las compras enviadas desde el servidor. Por defecto: vacío.',default:'' },
  metaPixelId: { type:'string',label:'Medición · ID del píxel de Meta',description:'Solo cifras. Por defecto: vacío.',default:'' },
  serverConversions: { type:'boolean',label:'Conversiones · Enviar compras confirmadas a GA4 y Meta',description:'Necesita el ID y la clave de cada uno. Por defecto: apagado.',default:false },
  ga4ApiSecret: { type:'secret',label:'Conversiones · Clave secreta de GA4 (Measurement Protocol)',description:'GA4 → flujo Web → Secretos de API de Measurement Protocol. Se guarda cifrada.' },
  metaCapiToken: { type:'secret',label:'Conversiones · Token de la API de conversiones de Meta',description:'Administrador de eventos → Configuración → API de conversiones. Se guarda cifrado.' },
  openaiPixelId: { type:'string',label:'ChatGPT Ads · ID del píxel de OpenAI',description:'Ads Manager → Conversiones → Fuente de datos (pixel_id, no el cds_…). Carga el píxel de medición en todas las páginas, con el mismo permiso de publicidad que Meta. Por defecto: vacío.',default:'' },
  openaiCapiKey: { type:'secret',label:'ChatGPT Ads · Clave de la Conversions API',description:'Envía cada compra aprobada de Hotmart a OpenAI (evento order_created). Solo se usa en el servidor. Se guarda cifrada.' },
  hotmartHottok: { type:'secret',label:'Conversiones · HOTTOK del webhook de Hotmart',description:'Hotmart → Herramientas → Webhook → autenticación. No es el Client Secret de la API. Se guarda cifrado.' },
  consentNotice: { type:'select',label:'Cookies · Aviso de cookies',description:'Discreto: sin letrero, se mide desde la primera visita y un icono pequeño abajo a la izquierda abre las preferencias. Aviso completo: letrero y no se mide nada hasta que la persona acepte. Solo enlace en el pie: como el discreto, sin icono. Por defecto: Discreto.',default:CONSENT_OPTIONS_DEFAULT.mode,options:[{value:'discreto',label:'Discreto'},{value:'completo',label:'Aviso completo'},{value:'pie',label:'Solo enlace en el pie'}] },
  consentEurope: { type:'boolean',label:'Cookies · Mostrar el aviso a visitantes de Europa',description:'Unión Europea, resto del Espacio Económico Europeo, Reino Unido y Suiza ven el aviso completo y no se miden hasta aceptar, sea cual sea el modo. Por defecto: encendido.',default:CONSENT_OPTIONS_DEFAULT.europe },
} satisfies Record<string, SettingField>;
export type SettingKey = keyof typeof settingsSchema;
export const publicKeys = ['browserMode','gtmId','gtmDelay','ga4Id','metaPixelId','openaiPixelId','serverConversions','consentNotice','consentEurope'] as const;
export const secretKeys = ['ga4ApiSecret','metaCapiToken','openaiCapiKey','hotmartHottok'] as const;
export interface PublicSettings { browserMode:'off'|'gtm'|'direct';gtmId:string;gtmDelay:boolean;ga4Id:string;metaPixelId:string;openaiPixelId:string;serverConversions:boolean;consentNotice:ConsentNoticeMode;consentEurope:boolean }
export const defaults:PublicSettings = {browserMode:'off',gtmId:'',gtmDelay:true,ga4Id:'',metaPixelId:'',openaiPixelId:'',serverConversions:false,consentNotice:CONSENT_OPTIONS_DEFAULT.mode,consentEurope:CONSENT_OPTIONS_DEFAULT.europe};
const patterns = {gtmId:/^GTM-[A-Z0-9]{4,20}$/,ga4Id:/^G-[A-Z0-9]{4,20}$/,metaPixelId:/^\d{5,30}$/,openaiPixelId:/^[A-Za-z0-9_-]{8,64}$/};

export function validateUpdates(input:unknown):Partial<Record<SettingKey,string|boolean>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida.');
  const result:Partial<Record<SettingKey,string|boolean>>={};
  for (const [key,value] of Object.entries(input)) {
    if (!Object.hasOwn(settingsSchema,key)) throw new Error('El campo no pertenece a estas integraciones.');
    const k=key as SettingKey;
    if(k==='serverConversions'||k==='gtmDelay'||k==='consentEurope') {
      if(typeof value!=='boolean')throw new Error(k==='gtmDelay'?'Indica si Tag Manager se carga después de la página.':k==='consentEurope'?'Indica si se muestra el aviso a visitantes de Europa.':'Selecciona si deseas enviar conversiones.');
      result[k]=value; continue;
    }
    if(typeof value!=='string')throw new Error('El valor debe ser texto.');
    const clean=value.trim();
    if(clean.length>8192||/[\r\n\u0000]/.test(clean))throw new Error('El valor contiene caracteres no permitidos.');
    if(k==='browserMode'&&!['off','gtm','direct'].includes(clean))throw new Error('Selecciona un modo de medición válido.');
    if(k==='consentNotice'&&!CONSENT_NOTICE_MODES.includes(clean as ConsentNoticeMode))throw new Error('Selecciona un modo de aviso de cookies válido.');
    if(Object.hasOwn(patterns,k)&&clean&&!patterns[k as keyof typeof patterns].test(clean))throw new Error(`Revisa el formato de ${settingsSchema[k].label}. Pega solo el identificador, sin código HTML.`);
    result[k]=clean;
  }
  return result;
}
export async function readPublic(settings:Pick<SettingsAccess,'get'>):Promise<PublicSettings> {
  const out={...defaults};
  const values=await Promise.all(publicKeys.map(key=>settings.get(key)));
  for(const [index,key] of publicKeys.entries()){
    const value=values[index];
    if(value===null)continue;
    // The native generic settings form only validates types. Invalid IDs never reach HTML.
    try{Object.assign(out,validateUpdates({[key]:value}));}catch{/* Fail closed for this setting. */}
  }
  return out;
}
/** Modo del aviso de cookies y excepción europea (se leen también fuera de producción, para revisarlo en staging). */
export async function readConsentOptions(settings:Pick<SettingsAccess,'get'>):Promise<ConsentOptions> {
  const out:ConsentOptions={...CONSENT_OPTIONS_DEFAULT};
  const [mode,europe]=await Promise.all([settings.get('consentNotice'),settings.get('consentEurope')]);
  try{const v=validateUpdates({consentNotice:mode});if(v.consentNotice)out.mode=v.consentNotice as ConsentNoticeMode;}catch{/* valor por defecto */}
  if(typeof europe==='boolean')out.europe=europe;
  return out;
}
export async function adminConfig(settings:Pick<SettingsAccess,'get'>) {
  const config=await readPublic(settings);
  const secretsSet:Record<string,boolean>={};
  for(const key of secretKeys)secretsSet[key]=Boolean(await settings.get<string>(key));
  return {config,secretsSet};
}

/**
 * GTM y lo que carga (GA4 por la pasarela de Google, píxel de Meta, Clarity) son ≈600 KB de
 * JavaScript que compiten con la foto principal y el CSS en móvil. Se cargan tras `load` y un
 * momento libre del navegador, o con la primera interacción si llega antes. Los eventos que el
 * sitio empuja antes quedan en dataLayer y GTM los procesa al arrancar; gclid/fbclid siguen en la
 * URL. Mismo criterio que Sovialis. Si la pasarela de Google de Cloudflare ya inyectó este mismo
 * contenedor (`google_tags_first_party`), no se carga una segunda vez.
 */
function deferredTagManager(id:string):string {
  return `window.sablyTrackingMode='gtm';(function(w,d,i){var done,ev=['pointerdown','keydown','touchstart','scroll','mousemove'];function go(){if(done)return;done=1;if((w.google_tags_first_party||[]).indexOf(i)>-1)return;ev.forEach(function(e){w.removeEventListener(e,go,{passive:true})});w.dataLayer=w.dataLayer||[];w.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});var j=d.createElement('script');j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;d.head.appendChild(j)}ev.forEach(function(e){w.addEventListener(e,go,{passive:true})});function idle(){w.requestIdleCallback?w.requestIdleCallback(go,{timeout:2500}):setTimeout(go,1200)}d.readyState==='complete'?idle():w.addEventListener('load',idle)})(window,document,'${id}');`;
}

/**
 * Píxel de medición de ChatGPT Ads (snippet oficial de OpenAI, `oaiq`), gobernado por el permiso de publicidad del
 * aviso de cookies, como Meta. La cola `oaiq` existe desde el principio (init + page_viewed y los eventos que empuje
 * `trackEvent`), pero `oaiq.min.js` solo se descarga cuando se sabe que hay permiso: si aún no se conoce el país o la
 * respuesta, espera a `sably:consent-ready` (país resuelto) o `sably:consent` (respuesta); si se retira, `oaiq('consent', false)` borra `__oppref` y `__obref`.
 *
 * Además adjunta el clic de ChatGPT al enlace de pago: en mousedown/click sobre Hotmart añade `opp~<__oppref>` y
 * `obr~<__obref>` al `sck` (Hotmart lo devuelve en la venta y el webhook lo reenvía a la Conversions API). Si aún no
 * hay `sck`, lo arma igual que el decorador de GTM (`fbp~|fbc~|cid~|gcl~`), que no toca un `sck` existente.
 */
export function openaiPixelScript(pixelId:string):string {
  return `(function(w,d,P){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var st=0;
function load(){var j=d.createElement('script');j.async=true;j.src='https://bzrcdn.openai.com/sdk/oaiq.min.js';var f=d.getElementsByTagName('script')[0];f?f.parentNode.insertBefore(j,f):d.head.appendChild(j)}
function sync(on){if(on){if(!st)load();else if(st<0)w.oaiq('consent',true);st=1}else if(st>0){w.oaiq('consent',false);st=-1}}
w.oaiq('init',{pixelId:P});w.oaiq('measure','page_viewed',{type:'contents',contents:[{id:location.pathname,content_type:'page'}]});
var c=w.sablyConsent&&w.sablyConsent.get();if(!w.sablyConsent)sync(true);else if(c)sync(!!c.ads);
['sably:consent','sably:consent-ready'].forEach(function(t){d.addEventListener(t,function(e){sync(!!(e.detail&&e.detail.ads))})});
function ck(n){var m=d.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=([^;]+)'));try{return m?decodeURIComponent(m[1]):''}catch(x){return ''}}
function deco(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a||!/hotm\\.art|hotm\\.io|(pay|go)\\.hotmart\\.com/.test(a.href))return;
var o=ck('__oppref'),b=ck('__obref');if(!o&&!b)return;try{var u=new URL(a.href),old=u.searchParams.get('sck')||'',p=old.split('|').filter(function(x){return x&&!/^(opp|obr)~/.test(x)});
if(!old){var v=ck('_fbp');v&&p.push('fbp~'+v);(v=ck('_fbc'))&&p.push('fbc~'+v);(v=ck('_ga'))&&(v=v.split('.').slice(-2).join('.'))&&p.push('cid~'+v);(v=ck('_gcl_aw'))&&(v=v.split('.').slice(2).join('.'))&&p.push('gcl~'+v)}
if(b)p.unshift('obr~'+b);if(o)p.unshift('opp~'+o);var s=p.join('|');while(s.length>300&&p.length>1){p.pop();s=p.join('|')}
if(s!==old){u.searchParams.set('sck',s);a.href=u.toString()}}catch(x){}}
['mousedown','click','auxclick'].forEach(function(t){d.addEventListener(t,deco)})})(window,document,${JSON.stringify(pixelId)});`;
}

export function trackingFragments(config:PublicSettings, production:boolean):PageFragmentContribution[] {
  if(!production)return [];
  const result:PageFragmentContribution[]=[];
  const inline=(key:string,code:string)=>result.push({kind:'inline-script',placement:'head',key,code});
  // El píxel de OpenAI no depende del modo de GA4/Meta: va primero para no perder el oppref de la URL de llegada.
  if(patterns.openaiPixelId.test(config.openaiPixelId))inline('sably-openai-pixel',openaiPixelScript(config.openaiPixelId));
  if(config.browserMode==='off')return result;
  if(config.browserMode==='gtm'&&patterns.gtmId.test(config.gtmId)) {
    inline('sably-tag-manager',config.gtmDelay?deferredTagManager(config.gtmId):`window.sablyTrackingMode='gtm';(function(w,d,s,l,i){if((w.google_tags_first_party||[]).indexOf(i)>-1)return;w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtmId}');`);
    result.push({kind:'html',placement:'body:start',key:'sably-tag-manager-noscript',html:`<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${config.gtmId}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`});
  } else if(config.browserMode==='direct') {
    inline('sably-tracking-mode',"window.sablyTrackingMode='direct';");
    if(patterns.ga4Id.test(config.ga4Id)) {
      result.push({kind:'html',placement:'head',key:'sably-ga4-loader',html:`<script async src="https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}"></script>`});
      inline('sably-ga4',`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${config.ga4Id}');`);
    }
    if(patterns.metaPixelId.test(config.metaPixelId))inline('sably-meta',`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.metaPixelId}');fbq('track','PageView');`);
  }
  return result;
}

export async function resolveIntegrationBindings(bindings:LegacyBindings,url:string,settings:Pick<SettingsAccess,'get'>):Promise<LegacyBindings> {
  // Never read credentials for a preview or a non-production domain.
  if(bindings.SABLY_ENVIRONMENT!=='production'||!operationalEnvironmentEnabled(bindings,url))return bindings;
  const config=await readPublic(settings);
  const hottok=await settings.get<string>('hotmartHottok');
  const out={...bindings,SABLY_HOTMART_HOTTOK:hottok??bindings.SABLY_HOTMART_HOTTOK,
    SABLY_GA4_MEASUREMENT_ID:config.ga4Id,SABLY_META_CAPI_PIXEL_ID:config.metaPixelId,
    SABLY_GA4_API_SECRET:undefined as string|undefined,SABLY_META_CAPI_TOKEN:undefined as string|undefined,
    SABLY_OPENAI_PIXEL_ID:undefined as string|undefined,SABLY_OPENAI_CAPI_KEY:undefined as string|undefined};
  // La Conversions API de OpenAI tiene su propio interruptor: el píxel configurado y su clave (CMS o .env).
  if(patterns.openaiPixelId.test(config.openaiPixelId)){
    out.SABLY_OPENAI_PIXEL_ID=config.openaiPixelId;
    out.SABLY_OPENAI_CAPI_KEY=(await settings.get<string>('openaiCapiKey'))??bindings.SABLY_OPENAI_CAPI_KEY;
  }
  if(config.serverConversions){
    if(patterns.ga4Id.test(config.ga4Id))out.SABLY_GA4_API_SECRET=(await settings.get<string>('ga4ApiSecret'))??bindings.SABLY_GA4_API_SECRET;
    if(patterns.metaPixelId.test(config.metaPixelId))out.SABLY_META_CAPI_TOKEN=(await settings.get<string>('metaCapiToken'))??bindings.SABLY_META_CAPI_TOKEN;
  }
  return out;
}
