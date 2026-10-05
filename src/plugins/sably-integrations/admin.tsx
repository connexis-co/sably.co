import { useEffect, useState } from 'react';
import { defaults, validateUpdates, type PublicSettings } from './model';
type SecretState=Record<string,boolean>;
type ConfigResponse={config:PublicSettings;secretsSet:SecretState;environment?:string};
type NativeSettings={values:Record<string,unknown>;secretsSet:SecretState};
async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(`/_emdash/api/${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-EmDash-Request':'1'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json() as {success:boolean;data:T;error?:{message?:string}};
  if(!response.ok||!result.success)throw new Error(result.error?.message||'No se pudo guardar. Inténtalo de nuevo.');
  return result.data;
}
function Secret({label,configured,value,help,onChange}:{label:string;configured:boolean;value:string|undefined;help:string;onChange:(value:string|undefined)=>void}){
  return <label>{label}<span className="integration-secret"><input type="password" autoComplete="new-password" spellCheck={false} value={value??''} placeholder={configured?'Configurada · escribe para reemplazar':'Pega la clave aquí'} onChange={e=>onChange(e.target.value||undefined)}/>{configured&&<button type="button" className="secondary" onClick={()=>onChange(value===''?undefined:'')}>{value===''?'Conservar':'Eliminar'}</button>}</span><small>{value===''?'Se eliminará al guardar.':help}</small></label>;
}
function IntegrationsAdmin(){
  const [config,setConfig]=useState<PublicSettings>(defaults),[secrets,setSecrets]=useState<SecretState>({}),[draft,setDraft]=useState<Record<string,string|undefined>>({});
  const [environment,setEnvironment]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const [brevo,setBrevo]=useState({fromEmail:'contacto@sably.co',fromName:'Sably',notificationEmail:'contacto@sably.co'}),[brevoKey,setBrevoKey]=useState<string|undefined>(),[brevoSet,setBrevoSet]=useState(false),[mailAvailable,setMailAvailable]=useState(false),[mailReady,setMailReady]=useState(false);
  const report=(text:string,failed=false)=>{setMessage(text);setError(failed)};
  useEffect(()=>{
    api<ConfigResponse>('plugins/sably-integrations/config').then(r=>{setConfig(r.config);setSecrets(r.secretsSet);setEnvironment(r.environment??'');setReady(true)}).catch(()=>report('No se pudieron cargar las integraciones. Necesitas permisos para administrar plugins.',true));
    Promise.all([api<NativeSettings>('admin/plugins/sably-brevo/settings'),api<NativeSettings>('admin/plugins/sably-operations/settings'),api<{available:boolean;selectedProviderId:string|null}>('settings/email')]).then(([b,o,m])=>{setBrevo({fromEmail:String(b.values.fromEmail||'contacto@sably.co'),fromName:String(b.values.fromName||'Sably'),notificationEmail:String(o.values.notificationEmail||'contacto@sably.co')});setBrevoSet(Boolean(b.secretsSet.apiKey));setMailAvailable(m.available&&m.selectedProviderId==='sably-brevo');setMailReady(true)}).catch(()=>report('No se pudo cargar Brevo. Recarga antes de configurar el correo.',true));
  },[]);
  const update=<K extends keyof PublicSettings>(key:K,value:PublicSettings[K])=>setConfig(c=>({...c,[key]:value}));
  async function save(section:'tracking'|'sales'){
    setBusy(section);report('');
    try{
      const values=section==='tracking'?{browserMode:config.browserMode,gtmId:config.gtmId,gtmDelay:config.gtmDelay,ga4Id:config.ga4Id,metaPixelId:config.metaPixelId}:{serverConversions:config.serverConversions,ga4Id:config.ga4Id,metaPixelId:config.metaPixelId,...Object.fromEntries(Object.entries(draft).filter(([,v])=>v!==undefined))};
      validateUpdates(values);
      if(section==='tracking'&&config.browserMode==='gtm'&&!config.gtmId.trim())throw new Error('Ingresa el ID del contenedor de Tag Manager.');
      if(section==='tracking'&&config.browserMode==='direct'&&!config.ga4Id.trim()&&!config.metaPixelId.trim())throw new Error('Ingresa al menos un ID de GA4 o Meta.');
      const result=await api<ConfigResponse>('plugins/sably-integrations/save','POST',values);
      setSecrets(result.secretsSet);if(section==='sales')setDraft({});
      report(environment==='production'?'Guardado. Los cambios se aplican en las próximas visitas, sin desplegar.':'Guardado en desarrollo. La medición y las conversiones externas siguen desactivadas aquí.');
    }catch(e){report(e instanceof Error?e.message:'No se pudo guardar.',true)}finally{setBusy('')}
  }
  async function saveMail(){
    setBusy('mail');report('');
    try{
      const validEmail=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
      if(!validEmail.test(brevo.fromEmail.trim())||!validEmail.test(brevo.notificationEmail.trim()))throw new Error('Revisa las direcciones de correo.');
      if(!brevo.fromName.trim())throw new Error('Escribe el nombre del remitente.');
      const result=await api<NativeSettings>('admin/plugins/sably-brevo/settings','PUT',{values:{fromEmail:brevo.fromEmail.trim(),fromName:brevo.fromName.trim(),...(brevoKey!==undefined?{apiKey:brevoKey||null}:{})}});
      setBrevoSet(Boolean(result.secretsSet.apiKey));setBrevoKey(undefined);
      await api('admin/plugins/sably-operations/settings','PUT',{values:{notificationEmail:brevo.notificationEmail.trim()}});
      report('Correo guardado. El remitente debe estar verificado en Brevo. No se ha enviado ningún correo de prueba.');
    }catch(e){report(e instanceof Error?e.message:'No se pudo guardar el correo.',true)}finally{setBusy('')}
  }
  return <div className="sably-integrations"><style>{`
.sably-integrations{max-width:1120px;margin:auto;padding:32px 24px;color:var(--foreground,inherit)}.sably-integrations h1{font-size:30px;font-weight:700;margin-bottom:8px}.sably-integrations h2{font-size:21px;font-weight:650;margin:0}.sably-integrations p{line-height:1.6;margin:10px 0}.sably-integrations .intro{max-width:720px;opacity:.8}.sably-integrations nav{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}.sably-integrations nav a{padding:9px 14px;border:1px solid #8885;border-radius:8px}.sably-integrations section{scroll-margin-top:24px;border:1px solid #8885;border-radius:12px;padding:24px;margin:20px 0}.sably-integrations .heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sably-integrations .badge{font-size:12px;border-radius:24px;padding:5px 10px;background:#8882}.sably-integrations .notice{padding:12px 16px;border-left:3px solid #4266db;background:#4266db10;border-radius:4px}.sably-integrations .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:20px 0}.sably-integrations label{display:flex;flex-direction:column;gap:8px;font-size:14px;font-weight:550}.sably-integrations input:not([type=checkbox]),.sably-integrations select{width:100%;padding:11px;border:1px solid #8887;border-radius:7px;background:var(--background,transparent);color:inherit}.sably-integrations small{font-weight:400;opacity:.75;line-height:1.5}.sably-integrations .check{flex-direction:row;align-items:center;margin:18px 0}.sably-integrations button{background:#2853d4;color:white;border-radius:7px;padding:10px 16px;font-size:14px;font-weight:550}.sably-integrations button:disabled{opacity:.5}.sably-integrations .secondary{border:1px solid #8885;background:transparent;color:inherit}.sably-integrations .integration-secret{display:flex;gap:8px}.sably-integrations .integration-secret input{min-width:0}.sably-integrations [role=status],.sably-integrations [role=alert]{position:sticky;top:12px;z-index:2;padding:14px;border-radius:8px;background:var(--background,#fff);border:1px solid #4266db}.sably-integrations [role=alert]{border-color:#c3374d}.sably-integrations code{overflow-wrap:anywhere;font-size:13px}.sably-integrations details{margin:16px 0}.sably-integrations summary{cursor:pointer}.sably-integrations a{text-decoration:underline;text-underline-offset:3px}
`}</style>
      <h1>Integraciones de Sably</h1><p className="intro">Conecta la medición, las compras y el correo. Guarda cada sección para aplicar sus cambios sin modificar código ni volver a desplegar.</p>
      <p className="notice">{environment==='production'?'Producción · sably.co. Esta configuración afecta al sitio público.':'Desarrollo · configuración independiente. Aquí no se cargan etiquetas de medición ni se envían conversiones o correos operativos.'}</p>
      <nav aria-label="Secciones de integraciones"><a href="#measurement">Medición</a><a href="#sales">Compras y conversiones</a><a href="#email">Correo con Brevo</a></nav>
      {message&&<p role={error?'alert':'status'}>{message}</p>}
      {!ready?<p>Cargando integraciones…</p>:<>
      <section id="measurement"><div className="heading"><h2>Medición del sitio</h2><span className="badge">{config.browserMode==='off'?'Desactivada':config.browserMode==='gtm'?'Gestionada por Tag Manager':'Instalación directa'}</span></div>
        <p>Usa Tag Manager si ya administras tus etiquetas allí. En ese modo, Sably carga únicamente el contenedor y envía los eventos a su dataLayer.</p>
        <div className="grid"><label>¿Cómo quieres instalar la medición?<select value={config.browserMode} onChange={e=>update('browserMode',e.target.value as PublicSettings['browserMode'])}><option value="off">Desactivada</option><option value="gtm">Con Google Tag Manager (recomendado)</option><option value="direct">GA4 y Meta directamente</option></select></label>
          <label>ID de Tag Manager<input value={config.gtmId} placeholder="GTM-XXXXXXXX" spellCheck={false} onChange={e=>update('gtmId',e.target.value)}/><small>Tag Manager → espacio de trabajo → ID del contenedor. Pega solo el ID.</small></label>
          <label>ID de medición de GA4<input value={config.ga4Id} placeholder="G-XXXXXXXXXX" spellCheck={false} onChange={e=>update('ga4Id',e.target.value)}/><small>Google Analytics → Administrar → Flujos de datos → Web. También identifica las compras enviadas desde el servidor.</small></label>
          <label>ID del píxel de Meta<input value={config.metaPixelId} placeholder="Solo números" inputMode="numeric" onChange={e=>update('metaPixelId',e.target.value)}/><small>Meta → Administrador de eventos → conjunto de datos. Usa el mismo ID que tengas en Tag Manager.</small></label></div>
        {config.browserMode==='gtm'&&<label className="check"><input type="checkbox" checked={config.gtmDelay} onChange={e=>update('gtmDelay',e.target.checked)}/>Cargar Tag Manager después de la página (recomendado): la web se ve antes en móvil y los eventos previos se envían igual al cargar.</label>}
        <p className="notice">{config.browserMode==='gtm'?'GA4 y el píxel deben estar configurados dentro de Tag Manager. Los IDs de abajo se usan para las compras del servidor; Sably no vuelve a instalarlos en el navegador.':config.browserMode==='direct'?'Sably carga directamente los IDs indicados. No carga Tag Manager.':'No se cargarán etiquetas en el navegador. Las compras del servidor se controlan en la siguiente sección.'}</p>
        <button disabled={!!busy} onClick={()=>save('tracking')}>{busy==='tracking'?'Guardando…':'Guardar medición'}</button>
      </section>
      <section id="sales"><div className="heading"><h2>Compras y conversiones</h2><span className="badge">Hotmart {secrets.hotmartHottok?'configurado':'pendiente'}</span></div>
        <p>Hotmart confirma las compras mediante este webhook: <code>https://sably.co/api/hotmart-webhook</code></p>
        <div className="grid"><Secret label="HOTTOK de Hotmart" configured={!!secrets.hotmartHottok} value={draft.hotmartHottok} onChange={v=>setDraft(d=>({...d,hotmartHottok:v}))} help="Hotmart → Herramientas → Webhook → autenticación. No es el Client Secret de la API."/>
          <Secret label="API Secret de GA4" configured={!!secrets.ga4ApiSecret} value={draft.ga4ApiSecret} onChange={v=>setDraft(d=>({...d,ga4ApiSecret:v}))} help="En el flujo Web de GA4 → Secretos de API de Measurement Protocol."/>
          <Secret label="Token de Conversion API de Meta" configured={!!secrets.metaCapiToken} value={draft.metaCapiToken} onChange={v=>setDraft(d=>({...d,metaCapiToken:v}))} help="Administrador de eventos → Configuración → API de conversiones."/>
        </div><label className="check"><input type="checkbox" checked={config.serverConversions} onChange={e=>update('serverConversions',e.target.checked)}/>Enviar compras confirmadas a GA4 y Meta cuando tengan ID y clave configurados</label>
        <small>Las claves se guardan cifradas en EmDash. Deja el campo sin cambios para conservar la actual. «Configurada» indica que está guardada; no verifica la cuenta externa.</small><p><button disabled={!!busy} onClick={()=>save('sales')}>{busy==='sales'?'Guardando…':'Guardar compras y conversiones'}</button></p>
      </section></>}
      <section id="email"><div className="heading"><h2>Correo con Brevo</h2><span className="badge">{brevoSet?'Clave configurada':'Falta la clave'}</span></div><p>Recibe las solicitudes de contacto y envía los correos de EmDash con tu cuenta de Brevo.</p>
        {!mailReady?<p>Cargando configuración de correo…</p>:<><div className="grid"><Secret label="Clave API de Brevo" configured={brevoSet} value={brevoKey} onChange={setBrevoKey} help="Brevo → SMTP y API → Claves API. Pega una clave API, no una contraseña SMTP."/>
          <label>Correo del remitente<input type="email" value={brevo.fromEmail} onChange={e=>setBrevo(b=>({...b,fromEmail:e.target.value}))}/><small>Debe estar verificado en Brevo.</small></label>
          <label>Nombre del remitente<input value={brevo.fromName} onChange={e=>setBrevo(b=>({...b,fromName:e.target.value}))}/></label>
          <label>Recibir las solicitudes en<input type="email" value={brevo.notificationEmail} onChange={e=>setBrevo(b=>({...b,notificationEmail:e.target.value}))}/><small>Las solicitudes también quedan guardadas en Sably · operaciones.</small></label></div>
          {!mailAvailable&&<p className="notice">Comprueba que Sably · Brevo esté activo y seleccionado como proveedor de correo en la configuración de EmDash.</p>}
          <button disabled={!!busy} onClick={saveMail}>{busy==='mail'?'Guardando…':'Guardar correo'}</button></>}
      </section><p><small>Las configuraciones y claves son independientes por entorno y quedan fuera de la sincronización de contenido.</small></p>
    </div>;
}
export const pages={'/integrations':IntegrationsAdmin};
