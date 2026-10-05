import type { Promocion } from '../../lib/promo';
import { decodePromo } from './service';

/** Only live rows are public; query campaigns still require matching ?promo= client-side. */
export async function readActivePromos(db: D1Database, now = Math.floor(Date.now()/1000)): Promise<Promocion[]> {
  const { results } = await db.prepare('SELECT * FROM promocion WHERE activa=1 AND (desde IS NULL OR desde<=?) AND (hasta IS NULL OR hasta>?) ORDER BY prioridad DESC,id').bind(now,now).all<Record<string,unknown>>();
  return results.map(row => {
    const p = decodePromo(row);
    return { id:p.id, nombre:p.nombre, pct:p.pct, cupon:p.cupon, titular:p.titular, proveedores:p.proveedores,
      incluir:p.incluir, excluir:p.excluir, paises:p.paises, desde:p.desde === null ? null : p.desde*1000,
      hasta:p.hasta === null ? null : p.hasta*1000, prioridad:p.prioridad, urlKey:p.url_key || null, tema:p.tema, etiqueta:p.etiqueta };
  });
}

/** Epoch second of the next start or end of an active promotion that can reach this country, or null. */
export async function readNextPromoBoundary(db: D1Database, country: string, now = Math.floor(Date.now()/1000)): Promise<number | null> {
  const reaches = `activa=1 AND (paises='[]' OR instr(paises, ?)>0)`;
  const code = JSON.stringify(country.toLowerCase());
  const row = await db.prepare(`SELECT MIN(t) AS t FROM (SELECT desde AS t FROM promocion WHERE ${reaches} AND desde>? UNION ALL SELECT hasta FROM promocion WHERE ${reaches} AND hasta>?)`).bind(code,now,code,now).first<{t:number|null}>();
  return row?.t ?? null;
}

const requestPromos=new WeakMap<object,Promise<Promocion[]>>();
/** One read per render for the banner, the bar and the course card; scope is Astro.locals. */
export function readActivePromosForRequest(db:D1Database,scope:object):Promise<Promocion[]> {
  let result=requestPromos.get(scope);
  if(!result){result=readActivePromos(db);requestPromos.set(scope,result);}
  return result;
}

/** Preserves /api/v1/promo while making the EmDash calendar authoritative. */
export const onRequestGet: PagesFunction<{DB: D1Database}> = async ({env}) => {
  try { return Response.json({promos:await readActivePromos(env.DB),managed:true}); }
  catch { return Response.json({promos:[],managed:true,error:'Promociones temporalmente no disponibles.'},{status:503}); }
};

export interface PublicReview { id:string; slug:string; nombre:string; rating:number; texto:string; source:'hotmart-public'|'verified-purchase'; }
export async function readPublicReviews(db:D1Database,slug?:string):Promise<PublicReview[]> {
  const query = `SELECT id,slug,author_name AS nombre,rating,body AS texto,'hotmart-public' AS source FROM sably_public_review WHERE status='approved' ${slug?'AND slug=?':''}
    UNION ALL SELECT r.id,s.slug,r.author_name,r.rating,COALESCE(r.body,''),'verified-purchase' FROM course_review r JOIN subject s ON s.id=r.subject_id JOIN purchase p ON p.id=r.purchase_id AND p.subject_id=r.subject_id WHERE r.status='approved' AND s.is_active=1 ${slug?'AND s.slug=?':''} ORDER BY id LIMIT 1000`;
  const statement=db.prepare(query);
  const {results}=await (slug?statement.bind(slug,slug):statement).all<PublicReview>();
  return results;
}
export interface PublicComment {id:string;parent_id:string|null;author_name:string;body:string;country:string|null;created_at:number;utiles:number;respuestas?:PublicComment[]}
export async function readPublicComments(db:D1Database,subject:string):Promise<PublicComment[]> {
  const {results}=await db.prepare("SELECT id,parent_id,author_name,body,country,created_at,utiles FROM v_comment_hilo WHERE subject_id=? AND EXISTS(SELECT 1 FROM subject s WHERE s.id=subject_id AND s.kind='blog' AND s.is_active=1) ORDER BY created_at DESC LIMIT 500").bind(subject).all<PublicComment>();
  return results.filter(r=>!r.parent_id).map(parent=>({...parent,respuestas:results.filter(r=>r.parent_id===parent.id).sort((a,b)=>a.created_at-b.created_at)}));
}
export interface OperationalData { prices:Record<string,Record<string,number>>; ratings:Record<string,{rating:number;total:number;capturado:number}> }
const requestData=new WeakMap<object,Promise<OperationalData>>();
/** Cache belongs to Astro.locals, never a cross-request global or a build snapshot. */
export function readOperationalData(db:D1Database,scope?:object):Promise<OperationalData> {
  if(scope&&requestData.has(scope))return requestData.get(scope)!;
  const result=(async()=>{
    const [prices,ratings]=await Promise.all([db.prepare('SELECT slug,moneda,monto FROM hotmart_precio').all<{slug:string;moneda:string;monto:number}>(),db.prepare('SELECT slug,rating,total,capturado FROM hotmart_valoracion WHERE total>0').all<{slug:string;rating:number;total:number;capturado:number}>()]);
    const data:OperationalData={prices:{},ratings:{}};
    for(const row of prices.results){data.prices[row.slug]??={};data.prices[row.slug]![row.moneda]=row.monto;}
    for(const row of ratings.results)data.ratings[row.slug]={rating:row.rating,total:row.total,capturado:row.capturado};
    return data;
  })();
  if(scope)requestData.set(scope,result);
  return result;
}
export function operationalPrice(data:OperationalData,slug:string,country:{currency:string}):{monto:number;moneda:string;esLocal:boolean}|null {
  const values=data.prices[slug];if(!values)return null;
  const local=values[country.currency],usd=values.USD;
  if(local&&local>0&&(!usd||country.currency!=='COP'||(local/usd>=2400&&local/usd<=5200)))return{monto:local,moneda:country.currency,esLocal:true};
  return usd&&usd>0?{monto:usd,moneda:'USD',esLocal:false}:null;
}
export async function readOperationalPrice(db:D1Database,slug:string,country:{currency:string},scope?:object){return operationalPrice(await readOperationalData(db,scope),slug,country);}
export async function readOperationalRating(db:D1Database,slug:string,scope?:object){return(await readOperationalData(db,scope)).ratings[slug]??null;}
export async function readOperationalRatings(db:D1Database,scope?:object){return(await readOperationalData(db,scope)).ratings;}
export interface SocialProofDataset { avisos:{slug:string;titulo:string;pais:string}[];cursos:Record<string,{paises:{pais:string}[]}> }
export async function readSocialProof(db:D1Database):Promise<SocialProofDataset> {
  const row=await db.prepare("SELECT payload FROM sably_public_dataset WHERE id='social-proof'").first<{payload:string}>();
  if(!row)return{avisos:[],cursos:{}};
  return JSON.parse(row.payload) as SocialProofDataset;
}
