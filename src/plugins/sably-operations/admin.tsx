import { useEffect, useState } from 'react';
import type { PluginAdminExports } from 'emdash';
import { COUNTRIES } from './service';
import { contactCsv } from './contact-export';
import { api, CSS_SO, date, Field, Notice } from './admin-comun';
import { AjustesPage } from './ajustes-pagina';

function Summary() {
  const [data,setData]=useState<any>(),[message,setMessage]=useState('');
  useEffect(()=>{api('summary').then(setData).catch(e=>setMessage(e.message));},[]);
  const labels:Record<string,string>={leads:'Solicitudes',pendingComments:'Comentarios por revisar',pendingReviews:'Reseñas por revisar',livePromos:'Promociones vigentes',visitorVotes:'Votos de visitantes',subjects:'Temas activos'};
  return <><p>Contenido y operaciones de este entorno. La disponibilidad del correo y las ventas depende de su configuración.</p><Notice text={message}/><div className="so-stats">{Object.entries(data?.totals??{}).map(([k,v])=><article key={k}><strong>{String(v)}</strong><span>{labels[k]??k}</span></article>)}</div><p>Los cursos, artículos, países, categorías y testimonios se editan en las colecciones de Contenido de EmDash. La publicación del código la gestiona el flujo de despliegue del proyecto.</p></>;
}
function Reviews() {
  const [status,setStatus]=useState('pending'),[offset,setOffset]=useState(0),[data,setData]=useState<any>({items:[]}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState('');
  const refresh=()=>api(`reviews?status=${status}&offset=${offset}`).then(setData).catch(e=>setMessage(e.message));
  useEffect(()=>{void refresh();},[status,offset]);
  async function moderate(row:any,to:string) {setBusy(true);setMessage('');try{await api('moderate',{entity:row.entity,id:row.id,expectedStatus:row.status,status:to,reason});setMessage('Estado actualizado y registrado en la auditoría.');await refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <><p>Modera comentarios y reseñas de compradores. Las estrellas y el texto originales se conservan, junto con el vínculo a la compra.</p><div className="so-toolbar"><Field label="Estado"><select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);}}><option value="pending">Pendientes</option><option value="approved">Publicados</option><option value="rejected">Rechazados</option><option value="spam">Spam</option></select></Field><Field label="Motivo de moderación" hint="Se registra con tu usuario de EmDash."><input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></Field></div><Notice text={message}/><div className="so-list">{data.items.map((row:any)=><article key={`${row.entity}:${row.id}`}><div className="so-row"><strong>{row.author_name}</strong><span className="so-pill">{row.entity==='course_review'?`Compra verificada · ${row.rating}/5`:row.entity==='sably_public_review'?`Reseña pública Hotmart · ${row.rating}/5`:'Comentario'}</span></div><small>{row.subject_id} · {date(row.created_at)}</small><p className="so-body">{row.body||'Sin texto'}</p><div className="so-toolbar">{[['approved','Publicar'],['rejected','Rechazar'],['spam','Marcar spam'],['pending','Volver a pendientes']].filter(([v])=>v!==row.status).map(([v,label])=><button key={v} disabled={busy} onClick={()=>void moderate(row,v!)}>{label}</button>)}</div></article>)}</div>{!data.items.length&&<p>No hay elementos en este estado.</p>}<Pagination offset={offset} size={50} more={data.hasMore} onChange={setOffset}/></>;
}
function Pagination({offset,size,more,onChange}:{offset:number;size:number;more?:boolean;onChange:(n:number)=>void}) {return <div className="so-toolbar"><button disabled={!offset} onClick={()=>onChange(Math.max(0,offset-size))}>Anterior</button><span>Página {Math.floor(offset/size)+1}</span><button disabled={!more} onClick={()=>onChange(offset+size)}>Siguiente</button></div>;}
function Ratings() {
  const [data,setData]=useState<any>(),[message,setMessage]=useState('');
  useEffect(()=>{api('ratings').then(setData).catch(e=>setMessage(e.message));},[]);
  return <><p>Los promedios se calculan a partir de los registros originales. Las reseñas verificadas se administran en Moderación; los votos anónimos se muestran como una señal independiente.</p><Notice text={message}/>{[['hotmart','Promedios públicos de Hotmart'],['verified','Compradores verificados'],['visitors','Valoraciones de visitantes'],['articles','Valoraciones de artículos']].map(([key,label])=><section key={key}><h3>{label}</h3><div className="so-table"><table><thead><tr><th>Curso / artículo</th><th>Valoraciones</th><th>Promedio</th></tr></thead><tbody>{(data?.[key!]??[]).map((r:any)=><tr key={r.slug}><td>{r.slug}</td><td>{r.reviews??r.votos??r.votes}</td><td>{r.avg_rating??r.media} / 5</td></tr>)}</tbody></table>{!data?.[key!]?.length&&<p>Aún no hay valoraciones.</p>}</div></section>)}</>;
}
function Leads() {
  const [exporting,setExporting]=useState(false);
  const [country,setCountry]=useState(''),[course,setCourse]=useState(''),[offset,setOffset]=useState(0),[data,setData]=useState<any>({items:[]}),[message,setMessage]=useState('');
  useEffect(()=>{api(`leads?country=${encodeURIComponent(country)}&course=${encodeURIComponent(course)}&offset=${offset}`).then(setData).catch(e=>setMessage(e.message));},[country,course,offset]);
  async function download() {
    setExporting(true);setMessage('');
    try {
      const rows:Record<string,unknown>[]=[];
      for(let page=0;page<=100000;page+=100) {
        const result=await api<{items:Record<string,unknown>[];hasMore:boolean}>(`leads?country=${encodeURIComponent(country)}&course=${encodeURIComponent(course)}&offset=${page}`);
        rows.push(...result.items);
        if(!result.hasMore)break;
        if(page===100000)throw new Error('La exportación supera el límite. Filtra por país o curso.');
      }
      const url=URL.createObjectURL(new Blob([contactCsv(rows)],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='sably-contactos.csv';a.click();URL.revokeObjectURL(url);
    } catch(error) {setMessage((error as Error).message);} finally {setExporting(false);}
  }
  return <><p>Contactos registrados en este entorno. Acceso exclusivo para administradores. El CSV incluye todos los contactos de los filtros elegidos, con origen y consentimiento.</p><div className="so-toolbar"><Field label="País"><select value={country} onChange={e=>{setCountry(e.target.value);setOffset(0);}}><option value="">Todos</option>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Curso (slug exacto)"><input value={course} onChange={e=>{setCourse(e.target.value);setOffset(0);}}/></Field><button onClick={()=>void download()} disabled={exporting||!data.items.length}>{exporting?'Exportando…':'Exportar contactos filtrados'}</button></div><Notice text={message}/><div className="so-list">{data.items.map((r:any)=><article key={r.id}><strong>{r.name}</strong><p>Correo: {r.email}<br/>Teléfono: {r.phone||'No indicado'}</p><p>{r.course_interest||'Sin curso'} · {r.country||'Sin país'} · {date(r.created_at)}</p><p className="so-body">{r.source||'Origen no indicado'}</p><details><summary>Consentimiento · {r.policy_version}</summary><p>{r.text_shown}</p><small>{r.policy_url} · {date(r.granted_at)}</small></details></article>)}</div>{!data.items.length&&<p>No hay solicitudes para estos filtros.</p>}<Pagination offset={offset} size={100} more={data.hasMore} onChange={setOffset}/></>;
}
function OperationsPage() {
  const [tab,setTab]=useState('summary');
  const tabs=[['summary','Resumen'],['reviews','Moderación'],['ratings','Calificaciones'],['leads','Solicitudes']];
  return <div className="so"><style>{CSS_SO}</style><h1>Moderación y contactos</h1><small>Opiniones, calificaciones y solicitudes de contacto. Las campañas, la caja de compra y el vídeo están ahora en <a href="/_emdash/admin/plugins/sably-operations/ajustes">Ajustes del sitio</a>.</small><nav aria-label="Operaciones de Sably" className="so-nav">{tabs.map(([id,label])=><button key={id} aria-current={tab===id} onClick={()=>setTab(id!)}>{label}</button>)}</nav>{tab==='summary'?<Summary/>:tab==='reviews'?<Reviews/>:tab==='ratings'?<Ratings/>:<Leads/>}</div>;
}
export const pages: PluginAdminExports['pages'] = { '/ajustes': AjustesPage, '/operations': OperationsPage };
