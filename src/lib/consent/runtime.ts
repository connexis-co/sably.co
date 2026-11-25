import { CONSENT_COOKIE, CONSENT_MAX_AGE_S, CONSENT_VERSION, consentModeDefault } from './format';

/**
 * Script en línea del `<head>` (el primero, antes de cualquier etiqueta): Consent Mode v2 por defecto, lectura de la
 * respuesta guardada, bloqueo de Meta y Clarity hasta que haya permiso, y la parte interactiva del aviso (HTML y
 * CSS en banner.ts). Sin islas ni dependencias.
 *
 * Meta y Clarity viven como HTML personalizado dentro del contenedor de GTM, que Consent Mode no gobierna: se
 * adelantan sus colas. `fbq` (misma forma que el snippet oficial) hace que el snippet del contenedor no descargue
 * `fbevents.js`; sus init/track quedan en la cola y solo con publicidad aceptada se carga el script, que la vacía.
 * `clarity` arranca con `consentv2` denegado y su script (`clarity.ms/tag/…`), cuando el contenedor lo inserta, se
 * retiene hasta que se acepte la medición (se interceptan `insertBefore`/`appendChild` solo para esa URL y se restauran
 * al soltarlo). Aun con `consentv2` denegado Clarity manda datos sin cookies; por eso se retiene del todo.
 * `tags`: hay etiquetas de terceros en esta página (producción).
 */
export function consentRuntimeScript(tags: boolean): string {
  const cfg = JSON.stringify({ c: CONSENT_COOKIE, v: CONSENT_VERSION, age: CONSENT_MAX_AGE_S, t: tags, d: consentModeDefault() });
  return `(function(w,d,C){
var dl=w.dataLayer=w.dataLayer||[];
function gtag(){dl.push(arguments)}
if(!w.gtag)w.gtag=gtag;
function sig(b){return b?'granted':'denied'}
function read(){var m=new RegExp('(?:^|;\\\\s*)'+C.c+'=([^;]*)').exec(d.cookie),p;try{p=m&&/^(\\d{1,4})\\.([01])\\.([01])\\.(\\d{1,12})$/.exec(decodeURIComponent(m[1]))}catch(e){}
if(!p)return null;var n=Math.floor(Date.now()/1000),at=+p[4];if(+p[1]<C.v||at>n+300||n-at>C.age)return null;return{a:p[2]==='1',m:p[3]==='1',at:at}}
function upd(c){return{ad_storage:sig(c.m),ad_user_data:sig(c.m),ad_personalization:sig(c.m),analytics_storage:sig(c.a)}}
var ch=read(),metaOn=0;
gtag('consent','default',C.d);gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);
if(ch)gtag('consent','update',upd(ch));
if(C.t){
if(!w.fbq){var n=w.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!w._fbq)w._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];n.held=1}
if(!w.clarity)w.clarity=function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};
w.clarity('consentv2',{ad_Storage:sig(ch&&ch.m),analytics_Storage:sig(ch&&ch.a)});
if(!(ch&&ch.a)){var held=[],ins=Node.prototype.insertBefore,app=Node.prototype.appendChild,hold=function(f){return function(el){if(el&&el.tagName==='SCRIPT'&&/clarity\\.ms\\/tag\\//.test(el.src||'')){held.push([f,this,arguments]);return el}return f.apply(this,arguments)}};
Node.prototype.insertBefore=hold(ins);Node.prototype.appendChild=hold(app);
w.sablyReleaseClarity=function(){Node.prototype.insertBefore=ins;Node.prototype.appendChild=app;w.sablyReleaseClarity=null;held.splice(0).forEach(function(h){h[0].apply(h[1],h[2])})}}}
function meta(on){if(!C.t||!w.fbq)return;if(on){if(!metaOn&&w.fbq.held){metaOn=1;var s=d.createElement('script');s.async=1;s.src='https://connect.facebook.net/en_US/fbevents.js';d.head.appendChild(s)}else if(metaOn)w.fbq('consent','grant')}else if(metaOn)w.fbq('consent','revoke')}
function wipe(re){var h=location.hostname.split('.'),ds=[''];for(var i=0;i<h.length-1;i++)ds.push('; Domain='+(i?'.':'')+h.slice(i).join('.'));
d.cookie.split(';').forEach(function(x){var k=x.split('=')[0].trim();if(re.test(k))ds.forEach(function(dm){d.cookie=k+'=; Max-Age=0; Path=/'+dm})})}
function apply(c,keep){var prev=ch;ch={a:!!c.a,m:!!c.m,at:Math.floor(Date.now()/1000)};
try{d.cookie=C.c+'='+C.v+'.'+(ch.a?1:0)+'.'+(ch.m?1:0)+'.'+ch.at+'; Max-Age='+C.age+'; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'')}catch(e){}
gtag('consent','update',upd(ch));dl.push({event:'sably_consent_update',analytics_storage:sig(ch.a),ad_storage:sig(ch.m)});
if(C.t){w.clarity('consentv2',{ad_Storage:sig(ch.m),analytics_Storage:sig(ch.a)});if(ch.a&&w.sablyReleaseClarity)w.sablyReleaseClarity();if(prev&&prev.a&&!ch.a){w.clarity('consent',false);wipe(/^(_ga|_gid|_gat|_clck|_clsk)/)}meta(ch.m)}
if(prev&&prev.m&&!ch.m)wipe(/^(_gcl_|_gac_|_fbp|_fbc)/);
d.dispatchEvent(new CustomEvent('sably:consent',{detail:{analytics:ch.a,ads:ch.m}}))}
if(ch)meta(ch.m);
w.sablyConsent={get:function(){return ch?{analytics:ch.a,ads:ch.m}:null},set:function(c){apply({a:c&&c.analytics,m:c&&c.ads})},open:function(){d.dispatchEvent(new Event('sably:consent-open'))}};
/* Interfaz: el aviso es HTML (body:start) oculto hasta saber que no hay respuesta vigente. */
function ui(){var box=d.getElementById('sbc'),dlg=d.getElementById('sbc-dlg');if(!box||!dlg)return;
var ca=d.getElementById('sbc-a'),cm=d.getElementById('sbc-m'),live=d.getElementById('sbc-live'),back=null;
function show(v){box.hidden=!v}
function done(c){apply(c);show(false);if(dlg.open)dlg.close();live.textContent=live.getAttribute('data-msg');if(back&&back.focus&&d.contains(back))back.focus();back=null}
function open(from){back=from||d.activeElement;ca.checked=!!(ch&&ch.a);cm.checked=!!(ch&&ch.m);show(false);if(!dlg.open)dlg.showModal()}
if(!ch)show(true);
d.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('[data-sbc],[data-sably-consent-open]'):null;if(!t)return;
if(t.hasAttribute('data-sably-consent-open')){e.preventDefault();open(t);return}
var a=t.getAttribute('data-sbc');
if(a==='accept')done({a:1,m:1});else if(a==='reject')done({a:0,m:0});else if(a==='prefs')open(t);else if(a==='save')done({a:ca.checked,m:cm.checked});
else if(a==='all')done({a:1,m:1});else if(a==='close')dlg.close()});
d.addEventListener('sably:consent-open',function(){open()});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
dlg.addEventListener('close',function(){if(!ch)show(true)})}
d.readyState==='loading'?d.addEventListener('DOMContentLoaded',ui):ui()
})(window,document,${cfg});`;
}
