import { definePlugin, PluginRouteError } from 'emdash';
import { escapeHtmlAttr } from 'emdash/page';
import { courseSlugFromPage, resolveWhatsApp, validateSettings, withDefaults, type WhatsAppSettings } from './model';

/**
 * Burbuja flotante: círculo con dos ondas que se expanden y se apagan (3 ciclos al aparecer; quietas al pasar el
 * ratón o con `prefers-reduced-motion`). Aparece al bajar `revealAfter` px y se esconde mientras el pie está a la
 * vista (no tapa sus enlaces). `#sably-whatsapp` es el contenedor fijo de 52/56/58 px: lo miden el botón de subir,
 * el aviso de cookies y el blog, y sube con `translate` sobre lo fijo abajo (`--fijo-inferior`, sin CLS).
 * El aviso «¿Dudas? Escríbenos» cuelga al lado (absoluto: no cambia la caja que miden los demás).
 */
export const CSS = [
  '#sably-whatsapp{--wa-t:56px;position:fixed;z-index:50;width:var(--wa-t);height:var(--wa-t);bottom:calc(var(--wa-y) + env(safe-area-inset-bottom,0px));translate:0 calc(-1 * var(--fijo-inferior,0px))}',
  '@media(max-width:767px){#sably-whatsapp{--wa-t:52px}}@media(min-width:1024px){#sably-whatsapp{--wa-t:58px}}',
  'body[data-has-sticky] #sably-whatsapp{bottom:calc(var(--wa-y) + var(--barra-alto,57px) + 12px)}',
  '#sably-whatsapp[data-oculta]{visibility:hidden;pointer-events:none}',
  '.sw-cuerpo{position:relative;width:100%;height:100%}',
  '#sably-whatsapp[data-oculta] .sw-cuerpo{opacity:0;scale:.6}',
  '.sw-a{position:relative;z-index:1;display:flex;width:100%;height:100%;align-items:center;justify-content:center;border-radius:50%;color:#fff;background:var(--wa-color);box-shadow:0 0 0 1px rgb(0 0 0/.08),0 8px 20px -6px rgb(0 0 0/.4);text-decoration:none}',
  '.sw-a:focus-visible{outline:3px solid #1b1b3a;outline-offset:3px}',
  '.sw-a svg{width:56%;height:56%;fill:currentColor}',
  '.sw-onda{position:absolute;inset:0;border-radius:50%;background:var(--wa-color);opacity:0;pointer-events:none}',
  '@keyframes sw-onda{0%{scale:1;opacity:.5}100%{scale:1.85;opacity:0}}',
  '.sw-aviso{display:none;position:absolute;top:50%;right:calc(100% + 12px);translate:0 -50%;align-items:center;gap:2px;padding:4px 4px 4px 14px;border-radius:999px;background:#fff;color:#1b1b3a;box-shadow:0 0 0 1px #e3e4ee,0 10px 24px -10px rgb(27 27 58/.45);font:600 14px/20px var(--font-sans,system-ui,sans-serif);white-space:nowrap}',
  '#sably-whatsapp[data-lado=left] .sw-aviso{right:auto;left:calc(100% + 12px)}',
  // Con la píldora de compra de escritorio a la vista (ficha), al lado se montaba sobre «Inscribirme»: va encima de
  // la burbuja, pegado a su borde exterior (por encima de los 80 px de la píldora). Si además está «Volver arriba»,
  // que ocupa ese sitio, no se muestra.
  'body:has(.v2-fija-abajo:not([data-oculta])) #sably-whatsapp .sw-aviso{top:auto;bottom:calc(100% + 12px);right:0;left:auto;translate:none}',
  'body:has(.v2-fija-abajo:not([data-oculta])) #sably-whatsapp[data-lado=left] .sw-aviso{right:auto;left:0}',
  'body:has(.v2-fija-abajo:not([data-oculta])):has(.v2-subir:not([hidden])) #sably-whatsapp .sw-aviso{display:none!important}',
  '.sw-aviso button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:none;color:#5b5d78;cursor:pointer}',
  '.sw-aviso button:hover{background:#f1f2f7}.sw-aviso button:focus-visible{outline:2px solid #1b1b3a}.sw-aviso svg{width:14px;height:14px}',
  '@media(min-width:1024px) and (hover:hover){#sably-whatsapp[data-aviso]:not([data-oculta]) .sw-aviso{display:flex}}',
  '@media(prefers-reduced-motion:no-preference){',
  // Sin transición en `translate`: el aviso de cookies y el botón de subir lo miden al vuelo y medirían a mitad.
  '#sably-whatsapp{transition:visibility 0s}#sably-whatsapp[data-oculta]{transition:visibility 0s .2s}',
  '.sw-cuerpo{transition:opacity .2s cubic-bezier(.2,.8,.2,1),scale .2s cubic-bezier(.2,.8,.2,1)}',
  '.sw-a{transition:scale .2s}.sw-a:hover{scale:1.06}',
  '#sably-whatsapp[data-ondas]:not([data-oculta]) .sw-onda{animation:sw-onda 2s cubic-bezier(0,.45,.55,1) 3 backwards}',
  '#sably-whatsapp[data-ondas]:not([data-oculta]) .sw-onda+.sw-onda{animation-delay:.7s}',
  '#sably-whatsapp:is(:hover,:focus-within) .sw-onda{animation:none}',
  '.sw-aviso{transition:opacity .2s,display .2s allow-discrete}@starting-style{.sw-aviso{opacity:0}}',
  '}',
  '@media(prefers-reduced-motion:reduce){.sw-onda{display:none}}',
  '@media(max-width:767px){#sably-whatsapp[data-mobile=false]{display:none}}@media(min-width:768px){#sably-whatsapp[data-desktop=false]{display:none}}',
  '@media print{#sably-whatsapp{display:none}}',
].join('');
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
/**
 * Muestra la burbuja al bajar (o desde que carga si es corta la página), la esconde con el pie a la vista, apaga
 * las ondas tras la primera aparición y enseña el aviso una vez por sesión. Clic: evento `click_whatsapp` de
 * siempre con `whatsapp_origen: 'flotante'`.
 */
export const SCRIPT = `(()=>{const w=document.getElementById('sably-whatsapp');if(!w)return;const a=w.querySelector('a'),u=+w.dataset.umbral||0,e=(+w.dataset.espera||0)*1e3,baja=w.hasAttribute('data-al-bajar');let listo=!e,pie=!1,visto=!1,raf=0;`
  + `const corta=()=>document.documentElement.scrollHeight-innerHeight<u+120;`
  + `const ver=()=>{raf=0;const s=listo&&!pie&&(!baja||scrollY>=u||corta());if(s!==w.hasAttribute('data-oculta'))return;w.toggleAttribute('data-oculta',!s);if(s&&!visto){visto=!0;primera()}};`
  + `const pedir=()=>{if(!raf)raf=requestAnimationFrame(ver)};addEventListener('scroll',pedir,{passive:!0});addEventListener('resize',pedir,{passive:!0});if(e)setTimeout(()=>{listo=!0;pedir()},e);`
  + `const p=document.querySelector('footer.v2-pie')||document.querySelector('footer');if(p&&'IntersectionObserver'in window)new IntersectionObserver(x=>{pie=x[0].isIntersecting;pedir()},{rootMargin:'0px 0px -64px 0px'}).observe(p);`
  + `function primera(){setTimeout(()=>w.removeAttribute('data-ondas'),7e3);const t=w.querySelector('.sw-aviso'),k='sably:wa-aviso';if(!t||!matchMedia('(min-width:1024px) and (hover:hover)').matches)return;try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1')}catch(_){}`
  + `const q=setTimeout(()=>{w.setAttribute('data-aviso','');setTimeout(()=>w.removeAttribute('data-aviso'),8e3)},1500);t.querySelector('button').addEventListener('click',()=>{clearTimeout(q);w.removeAttribute('data-aviso');a.focus()})}`
  + `a.addEventListener('click',()=>{w.removeAttribute('data-aviso');window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'click_whatsapp',page_type:document.body.dataset.pageType||'unknown',whatsapp_rule:w.dataset.rule,whatsapp_origen:'flotante'})});pedir()})();`;
const ICON = 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.7 14.1c-.2.7-1.4 1.3-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-2.9-1.3-4.8-4.2-5-4.4-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.2.1.3 0 .5-.1.2-.2.4-.3.5l-.5.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.2.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3 0 .2 0 .7-.2 1.3Z';

/** Marcado de la burbuja. Oculta de entrada si espera al desplazamiento o a la demora: aparecer no mueve nada. */
export function renderButton(config: WhatsAppSettings, resolved: { url: string; rule: string }): string {
  const e = escapeHtmlAttr;
  const oculta = config.reveal || config.delay > 0;
  const attrs = [
    'id="sably-whatsapp"', `data-rule="${e(resolved.rule)}"`, `data-lado="${config.position}"`,
    `data-mobile="${config.mobile}"`, `data-desktop="${config.desktop}"`,
    `data-umbral="${config.reveal ? config.revealAfter : 0}"`, `data-espera="${config.delay}"`,
    config.reveal ? 'data-al-bajar' : '', oculta ? 'data-oculta' : '', config.animate ? 'data-ondas' : '',
    `style="--wa-y:${config.y}px;--wa-color:${config.color};${config.position}:${config.x}px"`,
  ].filter(Boolean).join(' ');
  const ondas = config.animate ? '<span class="sw-onda" aria-hidden="true"></span><span class="sw-onda" aria-hidden="true"></span>' : '';
  const aviso = config.tooltip ? `<div class="sw-aviso"><span aria-hidden="true">${e(config.tooltip)}</span><button type="button" aria-label="Cerrar aviso de WhatsApp">${CLOSE}</button></div>` : '';
  return `<style>${CSS}</style><div ${attrs}><div class="sw-cuerpo">${ondas}<a class="sw-a" href="${e(resolved.url)}" target="_blank" rel="noopener nofollow" aria-label="${e(config.label)}" data-whatsapp-origen="flotante"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON}"></path></svg></a>${aviso}</div></div>`;
}

export function createPlugin() {
  return definePlugin({
    id: 'sably-whatsapp', version: '1.0.0', capabilities: ['hooks.page-fragments:register'],
    admin: { pages: [{path:'/whatsapp',label:'WhatsApp',icon:'message-circle'}] },
    routes: {
      config: { methods:['GET'], permission:'settings:manage', request:{body:'none'}, handler:async ctx => ({config:withDefaults(await ctx.kv.get<WhatsAppSettings>('config'))}) },
      save: { methods:['POST'],permission:'settings:manage',request:{body:'json',maxBytes:65536},handler:async ctx => {
        let config:WhatsAppSettings;
        try { config = validateSettings(ctx.input); }
        catch(error){throw PluginRouteError.badRequest(error instanceof Error?error.message:'Configuración inválida.');}
        await ctx.kv.set('config',config); return {config};
      } },
      choices: { methods:['GET'],permission:'settings:manage',request:{body:'none'},handler:async () => {
        const {getCourses,getCategories,getCountries}=await import('@/lib/emdash-content');
        const [courses,categories,countries]=await Promise.all([getCourses(),getCategories(),getCountries()]);
        return {courses:courses.map(c=>({id:c.id,label:c.data.title})),categories:categories.map(c=>({id:c.slug,label:c.name})),countries:countries.map(c=>({id:c.code,label:c.name}))};
      } },
    },
    hooks: {
      'page:fragments': async ({page},ctx) => {
        const config = withDefaults(await ctx.kv.get<WhatsAppSettings>('config'));
        if (!config.enabled) return null;
        const url = new URL(page.url);
        if (url.pathname.startsWith('/_emdash') || url.pathname.startsWith('/admin')) return null;
        const {getCountry,getCourse}=await import('@/lib/emdash-content');
        const segments=url.pathname.split('/').filter(Boolean);
        const courseSlug=courseSlugFromPage(page);
        const [requestedCountry, course]=await Promise.all([getCountry(segments[0] ?? ''), courseSlug ? getCourse(courseSlug) : Promise.resolve(null)]);
        const country=requestedCountry ?? await getCountry('co');
        if (!country) return null;
        const resolved=resolveWhatsApp(config, {path:url.pathname,course:courseSlug,title:course?.data.title ?? page.pageTitle ?? page.title ?? 'los cursos de Sably',category:course?.data.category ?? '',country:country.code,countryName:country.name,countryNumber:country.whatsapp,url:url.origin+url.pathname});
        if(!resolved)return null;
        return [{kind:'html',placement:'body:end',key:'sably-whatsapp',html:renderButton(config,resolved)},{kind:'inline-script',placement:'body:end',key:'sably-whatsapp-events',code:SCRIPT}];
      },
    },
  });
}
