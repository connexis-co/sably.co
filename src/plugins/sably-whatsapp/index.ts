import { definePlugin, PluginRouteError } from 'emdash';
import { escapeHtmlAttr } from 'emdash/page';
import { DEFAULT_SETTINGS, courseSlugFromPage, resolveWhatsApp, validateSettings, type WhatsAppSettings } from './model';

const CSS = `#sably-whatsapp{position:fixed;z-index:50;width:56px;height:56px;bottom:calc(var(--wa-y) + env(safe-area-inset-bottom,0px));border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;background:var(--wa-color);box-shadow:2px 2px 6px #0006;text-decoration:none;transition:transform .2s}#sably-whatsapp:hover{transform:scale(1.07)}#sably-whatsapp svg{width:32px;height:32px;fill:currentColor}body[data-has-sticky] #sably-whatsapp{bottom:calc(var(--wa-y) + var(--barra-alto,57px) + 12px)}#sably-whatsapp[data-animate=true]:before{content:'';position:absolute;inset:5px;border:3px solid var(--wa-color);border-radius:50%;animation:sably-wa-wave 1.7s infinite;z-index:-1}@keyframes sably-wa-wave{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}@media(prefers-reduced-motion:reduce){#sably-whatsapp:before{animation:none!important}}@media(max-width:767px){#sably-whatsapp[data-mobile=false]{display:none}}@media(min-width:768px){#sably-whatsapp[data-desktop=false]{display:none}}`;
const ICON = 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.7 14.1c-.2.7-1.4 1.3-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-2.9-1.3-4.8-4.2-5-4.4-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.2.1.3 0 .5-.1.2-.2.4-.3.5l-.5.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.2.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3 0 .2 0 .7-.2 1.3Z';

export function createPlugin() {
  return definePlugin({
    id: 'sably-whatsapp', version: '1.0.0', capabilities: ['hooks.page-fragments:register'],
    admin: { pages: [{path:'/whatsapp',label:'Sably · WhatsApp',icon:'message-circle'}] },
    routes: {
      config: { methods:['GET'], permission:'settings:manage', request:{body:'none'}, handler:async ctx => ({config:await ctx.kv.get<WhatsAppSettings>('config') ?? DEFAULT_SETTINGS}) },
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
        const config = await ctx.kv.get<WhatsAppSettings>('config') ?? DEFAULT_SETTINGS;
        if (!config.enabled) return null;
        const url = new URL(page.url);
        if (url.pathname.startsWith('/_emdash') || url.pathname.startsWith('/admin')) return null;
        const {getCountry,getCourse}=await import('@/lib/emdash-content');
        const segments=url.pathname.split('/').filter(Boolean);
        const country=await getCountry(segments[0] ?? '') ?? await getCountry('co');
        if (!country) return null;
        const courseSlug=courseSlugFromPage(page);
        const course=courseSlug ? await getCourse(courseSlug) : null;
        const resolved=resolveWhatsApp(config, {path:url.pathname,course:courseSlug,title:course?.data.title ?? page.pageTitle ?? page.title ?? 'los cursos de Sably',category:course?.data.category ?? '',country:country.code,countryName:country.name,countryNumber:country.whatsapp,url:url.origin+url.pathname});
        if(!resolved)return null;
        const escape=escapeHtmlAttr;
        const html=`<style>${CSS}</style><a id="sably-whatsapp" href="${escape(resolved.url)}" target="_blank" rel="noopener nofollow" aria-label="${escape(config.label)}" data-rule="${escape(resolved.rule)}" data-mobile="${config.mobile}" data-desktop="${config.desktop}" data-animate="${config.animate}" style="--wa-y:${config.y}px;--wa-color:${config.color};${config.position}:${config.x}px${config.delay?';visibility:hidden':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON}"></path></svg></a>`;
        return [{kind:'html',placement:'body:end',key:'sably-whatsapp',html},{kind:'inline-script',placement:'body:end',key:'sably-whatsapp-events',code:`(()=>{const b=document.getElementById('sably-whatsapp');if(!b)return;${config.delay?`setTimeout(()=>{b.style.visibility='visible'},${config.delay*1000});`:''}b.addEventListener('click',()=>{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'click_whatsapp',page_type:document.body.dataset.pageType||'unknown',whatsapp_rule:b.dataset.rule})})})();`}];
      },
    },
  });
}
