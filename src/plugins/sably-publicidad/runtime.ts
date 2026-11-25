/**
 * CSS y scripts en línea del módulo de publicidad. Solo se emiten en páginas permitidas con el módulo encendido.
 *
 * 1. `puertaScript` (en el <head>, antes de pintar): marca <html data-sably-ads> si hay permiso de «Publicidad» en
 *    la cookie del aviso (`sably_consent`, formato en src/lib/consent/format.ts) o si el panel no lo exige. Sin esa
 *    marca los huecos están en `display:none` desde el primer pintado: no ocupan nada ni se mueven después.
 * 2. `motorScript` (al final del <body>): pide anuncios. Carga adsbygoogle.js UNA vez, tras la primera interacción o
 *    con el navegador libre (red de seguridad 3,5 s), y crea cada <ins> cuando su hueco se acerca a la pantalla.
 *    Solo en el dominio de producción: en local, staging o vistas previas los huecos se reservan y se muestran
 *    igual (con la misma regla de permiso) pero vacíos; no se carga nada de Google.
 *    Si se acepta la publicidad a mitad de visita, solo aparecen los huecos que están por debajo de la pantalla
 *    (los de arriba esperan a la siguiente página): así aceptar no mueve lo que se está leyendo.
 */
import { CONSENT_COOKIE, CONSENT_MAX_AGE_S, CONSENT_VERSION } from '@/lib/consent/format';
import type { ConfigPublicidad } from './model';

/** Escritorio desde 1024 px (la rejilla con lateral del V2 empieza ahí). */
export const CORTE_ESCRITORIO = 1024;
export const DOMINIOS_REALES = ['sably.co'];

export const PUBLICIDAD_CSS = [
  '.sably-ad{display:none;clear:both;margin:32px auto;text-align:center;contain:layout}',
  'html[data-sably-ads] .sably-ad,.sably-ad[data-mostrar]{display:block}',
  `@media (max-width:${CORTE_ESCRITORIO - 0.02}px){.sably-ad[data-dev=escritorio]{display:none!important}}`,
  `@media (min-width:${CORTE_ESCRITORIO}px){.sably-ad[data-dev=movil]{display:none!important}}`,
  '.sably-ad__rotulo{margin:0 0 8px;font:500 11px/16px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#5f6673}',
  // El hueco reserva el alto exacto de la creatividad (CLS 0). Ancho: el de la creatividad, sin pasar del contenedor.
  '.sably-ad__caja{width:min(100%,var(--sa-wm));height:var(--sa-hm);margin:0 auto;overflow:visible}',
  `@media (min-width:${CORTE_ESCRITORIO}px){.sably-ad__caja{width:min(100%,var(--sa-wd));height:var(--sa-hd)}}`,
  '.sably-ad[data-fmt=display-adaptable] .sably-ad__caja,.sably-ad[data-fmt=in-feed] .sably-ad__caja,.sably-ad[data-fmt=multiplex] .sably-ad__caja{width:100%}',
  // Fluidos: el alto reservado es el mínimo (pueden crecer; el panel lo advierte).
  '.sably-ad[data-fmt=in-article] .sably-ad__caja,.sably-ad[data-fmt=in-feed] .sably-ad__caja,.sably-ad[data-fmt=multiplex] .sably-ad__caja{height:auto;min-height:var(--sa-hm)}',
  `@media (min-width:${CORTE_ESCRITORIO}px){.sably-ad[data-fmt=in-article] .sably-ad__caja,.sably-ad[data-fmt=in-feed] .sably-ad__caja,.sably-ad[data-fmt=multiplex] .sably-ad__caja{min-height:var(--sa-hd)}}`,
  '.sably-ad--fija{position:sticky;top:var(--sably-ad-top,96px)}',
  'li.sably-ad{list-style:none;margin:0}',
  // Muestra: caja gris con la medida, sin pedir nada a Google.
  '.sably-ad[data-muestra] .sably-ad__caja{display:grid;place-items:center;border:1px dashed #b8bfcc;border-radius:8px;background:repeating-linear-gradient(135deg,#f3f4f7 0 10px,#eceef3 10px 20px);color:#5f6673;font:500 12px/1 system-ui,sans-serif}',
  '.sably-ad[data-muestra] .sably-ad__medida::before{content:attr(data-m)}',
  '.sably-ad__caja ins.adsbygoogle[data-ad-status=unfilled]{display:none!important}',
  '@media print{.sably-ad{display:none!important}}',
].join('');

export function puertaScript(config: ConfigPublicidad): string {
  const c = JSON.stringify({ k: CONSENT_COOKIE, v: CONSENT_VERSION, age: CONSENT_MAX_AGE_S, rc: config.exigirConsentimiento, mu: config.muestra });
  return `(function(d,C){var m=new RegExp('(?:^|;\\\\s*)'+C.k+'=(\\\\d{1,4})\\\\.[01]\\\\.([01])\\\\.(\\\\d{1,12})').exec(d.cookie),n=Date.now()/1000;
if(C.mu||!C.rc||(m&&+m[1]>=C.v&&m[2]==='1'&&n-m[3]<C.age&&m[3]<n+300))d.documentElement.setAttribute('data-sably-ads','')})(document,${c});`;
}

export function motorScript(config: ConfigPublicidad): string {
  const c = JSON.stringify({
    cl: config.cliente,
    rc: config.exigirConsentimiento,
    mu: config.muestra,
    au: config.automaticos.activos ? config.automaticos.dispositivo : '',
    ab: config.automaticos.activos && config.automaticos.anclaSoloAbajo,
    bp: CORTE_ESCRITORIO,
    dom: DOMINIOS_REALES,
  });
  return `(function(w,d,C){
var H=d.documentElement,huecos=[].slice.call(d.querySelectorAll('.sably-ad'));
huecos.forEach(function(h){var m=h.querySelector('.sably-ad__medida');if(m){var e=w.innerWidth>=C.bp,s=getComputedStyle(h);m.setAttribute('data-m',(e?s.getPropertyValue('--sa-wd'):s.getPropertyValue('--sa-wm')).trim()+' × '+(e?s.getPropertyValue('--sa-hd'):s.getPropertyValue('--sa-hm')).trim())}});
if(C.mu)return;
var real=C.dom.indexOf(location.hostname)>=0;
var esc=w.innerWidth>=C.bp,auto=C.au==='ambos'||(C.au==='escritorio'&&esc)||(C.au==='movil'&&!esc);
function visibles(){return huecos.filter(function(h){return h.getClientRects().length>0})}
function permiso(){if(!C.rc)return true;var c=w.sablyConsent&&w.sablyConsent.get();return !!(c&&c.ads)}
var lib=null,arrancado=false;
function cargar(){if(lib)return;lib=1;var q=w.adsbygoogle=w.adsbygoogle||[];
var c=w.sablyConsent&&w.sablyConsent.get();if(!(c&&c.ads))q.requestNonPersonalizedAds=1;
if(d.getElementById('sably-adsbygoogle'))return;var s=d.createElement('script');s.id='sably-adsbygoogle';s.async=true;s.crossOrigin='anonymous';
s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(C.cl);if(C.ab)s.setAttribute('data-overlays','bottom');d.head.appendChild(s)}
function pedir(h){if(h.getAttribute('data-estado'))return;h.setAttribute('data-estado','pedido');var u=h.getAttribute('data-unidad'),caja=h.querySelector('.sably-ad__caja');if(!u||!caja)return;
var f=h.getAttribute('data-fmt'),s=getComputedStyle(caja),ins=d.createElement('ins');ins.className='adsbygoogle';ins.setAttribute('data-ad-client',C.cl);ins.setAttribute('data-ad-slot',u);
if(f==='display-fijo'){ins.style.cssText='display:inline-block;width:'+s.width+';height:'+s.height}
else if(f==='display-adaptable'){ins.style.cssText='display:block;width:100%;height:'+s.height}
else{ins.style.display='block';if(f==='in-article'){ins.style.textAlign='center';ins.setAttribute('data-ad-layout','in-article');ins.setAttribute('data-ad-format','fluid')}
else if(f==='in-feed'){ins.setAttribute('data-ad-format','fluid');ins.setAttribute('data-ad-layout-key',h.getAttribute('data-clave')||'')}else ins.setAttribute('data-ad-format','autorelaxed')}
caja.appendChild(ins);try{(w.adsbygoogle=w.adsbygoogle||[]).push({})}catch(e){}}
function arrancar(){if(arrancado||!real||!permiso())return;var hs=visibles();if(!hs.length&&!auto)return;arrancado=true;
var go=function(){cargar();if(!('IntersectionObserver' in w)){hs.forEach(pedir);return}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);pedir(e.target)}})},{rootMargin:(esc?'400px':'600px')+' 0px'});hs.forEach(function(h){io.observe(h)})};
var hecho=false,una=function(){if(hecho)return;hecho=true;go()},o={once:true,passive:true};
['pointerdown','keydown','scroll','touchstart','wheel'].forEach(function(e){w.addEventListener(e,una,o)});
var ocio=function(){(w.requestIdleCallback||function(f){setTimeout(f,200)})(una,{timeout:1500})};
d.readyState==='complete'?ocio():w.addEventListener('load',ocio,{once:true});setTimeout(una,3500)}
d.addEventListener('sably:consent',function(e){if(!(e.detail&&e.detail.ads)||!C.rc||H.hasAttribute('data-sably-ads'))return;
huecos.forEach(function(h){h.setAttribute('data-mostrar','')});
huecos.forEach(function(h){if(h.getBoundingClientRect().top<=w.innerHeight)h.removeAttribute('data-mostrar')});arrancar()});
arrancar()
})(window,document,${c});`;
}
