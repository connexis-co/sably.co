import type { PageFragmentContribution, SettingField, SettingsAccess } from 'emdash';
import type { LegacyBindings } from '../../lib/legacy-backend';
import { operationalEnvironmentEnabled } from '../../lib/operational-environment';

export const settingsSchema = {
  browserMode: { type: 'select', label: 'Medición del sitio', default: 'off', options: [{value:'off',label:'Desactivada'},{value:'gtm',label:'Google Tag Manager'},{value:'direct',label:'GA4 y Meta directamente'}] },
  gtmId: { type:'string',label:'ID del contenedor de Tag Manager',default:'' },
  gtmDelay: { type:'boolean',label:'Cargar Tag Manager después de la página',default:true },
  ga4Id: { type:'string',label:'ID de medición de GA4',default:'' },
  metaPixelId: { type:'string',label:'ID del píxel de Meta',default:'' },
  serverConversions: { type:'boolean',label:'Enviar compras confirmadas a GA4 y Meta',default:false },
  ga4ApiSecret: { type:'secret',label:'API Secret de GA4' },
  metaCapiToken: { type:'secret',label:'Token de Conversion API de Meta' },
  hotmartHottok: { type:'secret',label:'HOTTOK del webhook de Hotmart' },
} satisfies Record<string, SettingField>;
export type SettingKey = keyof typeof settingsSchema;
export const publicKeys = ['browserMode','gtmId','gtmDelay','ga4Id','metaPixelId','serverConversions'] as const;
export const secretKeys = ['ga4ApiSecret','metaCapiToken','hotmartHottok'] as const;
export interface PublicSettings { browserMode:'off'|'gtm'|'direct';gtmId:string;gtmDelay:boolean;ga4Id:string;metaPixelId:string;serverConversions:boolean }
export const defaults:PublicSettings = {browserMode:'off',gtmId:'',gtmDelay:true,ga4Id:'',metaPixelId:'',serverConversions:false};
const patterns = {gtmId:/^GTM-[A-Z0-9]{4,20}$/,ga4Id:/^G-[A-Z0-9]{4,20}$/,metaPixelId:/^\d{5,30}$/};

export function validateUpdates(input:unknown):Partial<Record<SettingKey,string|boolean>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida.');
  const result:Partial<Record<SettingKey,string|boolean>>={};
  for (const [key,value] of Object.entries(input)) {
    if (!Object.hasOwn(settingsSchema,key)) throw new Error('El campo no pertenece a estas integraciones.');
    const k=key as SettingKey;
    if(k==='serverConversions'||k==='gtmDelay') {
      if(typeof value!=='boolean')throw new Error(k==='gtmDelay'?'Indica si Tag Manager se carga después de la página.':'Selecciona si deseas enviar conversiones.');
      result[k]=value; continue;
    }
    if(typeof value!=='string')throw new Error('El valor debe ser texto.');
    const clean=value.trim();
    if(clean.length>8192||/[\r\n\u0000]/.test(clean))throw new Error('El valor contiene caracteres no permitidos.');
    if(k==='browserMode'&&!['off','gtm','direct'].includes(clean))throw new Error('Selecciona un modo de medición válido.');
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

export function trackingFragments(config:PublicSettings, production:boolean):PageFragmentContribution[] {
  if(!production||config.browserMode==='off')return [];
  const result:PageFragmentContribution[]=[];
  const inline=(key:string,code:string)=>result.push({kind:'inline-script',placement:'head',key,code});
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
    SABLY_GA4_API_SECRET:undefined as string|undefined,SABLY_META_CAPI_TOKEN:undefined as string|undefined};
  if(config.serverConversions){
    if(patterns.ga4Id.test(config.ga4Id))out.SABLY_GA4_API_SECRET=(await settings.get<string>('ga4ApiSecret'))??bindings.SABLY_GA4_API_SECRET;
    if(patterns.metaPixelId.test(config.metaPixelId))out.SABLY_META_CAPI_TOKEN=(await settings.get<string>('metaCapiToken'))??bindings.SABLY_META_CAPI_TOKEN;
  }
  return out;
}
