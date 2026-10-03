import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { createPlugin } from '../src/plugins/sably-operations/index.ts';
import { authorize,listLeads,listPromos,moderate,savePromo,saveWidget,validatePromo } from '../src/plugins/sably-operations/service.ts';
import { readActivePromos,readPublicReviews,readPublicComments,readOperationalData,operationalPrice } from '../src/plugins/sably-operations/public.ts';
import { mejorPromocion } from '../src/lib/promo.ts';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  sql.exec(readFileSync(new URL('../src/plugins/sably-operations/migration.sql',import.meta.url),'utf8'));
  const prepare=(query:string)=>{
    let values:any[]=[];
    const statement={bind:(...v:any[])=>{values=v;return statement;},run:async()=>({success:true,results:[],meta:{changes:Number(sql.prepare(query).run(...values).changes)}}),all:async()=>({success:true,results:sql.prepare(query).all(...values),meta:{}}),first:async()=>sql.prepare(query).get(...values)??null};
    return statement;
  };
  const db={prepare,batch:async(statements:any[])=>{sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
  return {sql,db};
}
const admin={id:'test-admin',role:50},editor={id:'test-editor',role:40};
const promo={id:'test-campaign',nombre:'Campaña de prueba',activa:1,pct:50,titular:'Oferta de prueba',proveedores:['masterclasses'],incluir:[],excluir:[],paises:['co'],desde:100,hasta:300,prioridad:100,url_key:'ads50',tema:'maximo',etiqueta:'Prueba',actualizado:null};

test('every operations route requires EmDash permissions; settings are admin-only',()=>{
  for(const [name,route] of Object.entries(createPlugin().routes)) {
    assert.equal(route.public,false,name);assert.ok(route.permission,name);assert.ok(route.request,name);
  }
  assert.throws(()=>authorize(undefined),/rol/);
  assert.throws(()=>authorize({id:'contributor',role:20}),/rol/);
  assert.throws(()=>authorize(editor,true),/rol/);
  assert.equal(authorize(editor).id,editor.id);
});
test('validates real coupons, dates, URL keys and theme instead of accepting arbitrary HTML/config',()=>{
  assert.equal(validatePromo({...promo,cupon:'forged'}).cupon,'031016');
  for(const invalid of [{pct:40},{hasta:100},{url_key:'<script>'},{tema:'javascript:alert(1)'},{paises:['xx']},{incluir:['../../admin']}])assert.throws(()=>validatePromo({...promo,...invalid}));
});
test('campaigns preserve query targeting, window, exclusions and optimistic updates',async()=>{
  const {db,sql}=database();
  await savePromo(db,admin,promo);
  const rows=await readActivePromos(db,200);
  assert.equal(rows.length,1);
  assert.equal(mejorPromocion(rows,{countryCode:'co',proveedor:'masterclasses',urlKey:null,now:200000}),null);
  assert.equal(mejorPromocion(rows,{countryCode:'co',proveedor:'masterclasses',urlKey:'ads50',now:200000})?.id,promo.id);
  assert.equal(mejorPromocion(rows,{countryCode:'mx',proveedor:'masterclasses',urlKey:'ads50',now:200000}),null);
  assert.equal((await readActivePromos(db,300)).length,0);
  const saved=(await listPromos(db,admin)).promos[0]!;
  await savePromo(db,admin,{...saved,excluir:['curso-test']});
  await assert.rejects(()=>savePromo(db,admin,{...saved,nombre:'Cambio obsoleto'}),/otra sesión/);
  assert.equal(mejorPromocion(await readActivePromos(db,200),{countryCode:'co',proveedor:'masterclasses',urlKey:'ads50',courseSlug:'curso-test',now:200000}),null);
  sql.close();
});
test('moderation is conditional and creates exactly one authenticated audit record',async()=>{
  const {db,sql}=database();
  sql.exec("INSERT INTO subject(id,kind,slug) VALUES ('blog:test','blog','test'); INSERT INTO consent(id,purpose,policy_version,policy_url,text_shown,ip_hash) VALUES ('consent-test','comment','v1','/privacy','Synthetic consent','hash'); INSERT INTO comment(id,subject_id,author_name,body,consent_id,ip_hash) VALUES ('comment-test','blog:test','Test Author','Synthetic comment body','consent-test','hash');");
  const input={entity:'comment',id:'comment-test',expectedStatus:'pending',status:'approved',reason:'Test',moderator:'forged'};
  await moderate(db,editor,input);
  await assert.rejects(()=>moderate(db,editor,input),/otra sesión/);
  const logs=sql.prepare('SELECT * FROM moderation_log').all();
  assert.equal(logs.length,1);assert.equal(logs[0]!.moderator,'emdash:test-editor');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM v_comment_publico').get()!.n,1);
  await assert.rejects(()=>moderate(db,editor,{...input,entity:'lead'}),/Entidad/);
  sql.close();
});
test('widget settings enforce bounds and stale-write detection',async()=>{
  const {db,sql}=database();
  const version=sql.prepare('SELECT actualizado FROM widget_video').get()!.actualizado;
  await saveWidget(db,admin,{widget:'video',modo:'auto',bucle:1,actualizado:version});
  await assert.rejects(()=>saveWidget(db,admin,{widget:'video',modo:'play',bucle:0,actualizado:version}),/otra sesión/);
  await assert.rejects(()=>saveWidget(db,editor,{widget:'video',modo:'play',bucle:0,actualizado:version}),/rol/);
  assert.equal(sql.prepare('SELECT modo FROM widget_video').get()!.modo,'auto');sql.close();
});
test('admin contact inbox includes contact details and consent but excludes IP hashes',async()=>{
  const {db,sql}=database();
  sql.exec("INSERT INTO consent(id,purpose,policy_version,policy_url,text_shown,ip_hash) VALUES ('lead-consent','lead','v1','/privacy','Synthetic consent','private-hash'); INSERT INTO lead(id,name,email,phone,country,course_interest,consent_id,ip_hash) VALUES ('lead-test','Synthetic Person','test@example.invalid','0000000000','co','curso-test','lead-consent','private-hash');");
  const result=await listLeads(db,admin,{country:'co',course:'curso-test'});
  assert.equal(result.items.length,1);const json=JSON.stringify(result);assert.ok(json.includes('Synthetic consent'));assert.ok(json.includes('test@example.invalid'));assert.ok(!json.includes('private-hash'));assert.ok(json.includes('0000000000'));
  await assert.rejects(()=>listLeads(db,undefined,{}),/rol/);await assert.rejects(()=>listLeads(db,editor,{}),/rol/);
  assert.equal((await listLeads(db,admin,{country:'mx'})).items.length,0);sql.close();
});
test('authored calendar and public baseline seed contain no personal data and retain live override priority',async()=>{
  const {db,sql}=database();
  for(const file of ['calendar-seed.sql','public-settings-seed.sql'])sql.exec(readFileSync(new URL(`../src/plugins/sably-operations/${file}`,import.meta.url),'utf8'));
  const campaigns=(await listPromos(db,admin)).promos;
  assert.equal(campaigns.length,12);
  assert.ok(campaigns.find(p=>p.id==='legacy-manual')!.prioridad>Math.max(...campaigns.filter(p=>p.id!=='legacy-manual').map(p=>p.prioridad)));
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM lead').get()!.n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM purchase').get()!.n,0);sql.close();
});
test('moderating imported public reviews changes the next SSR read and cannot be undone by reseeding',async()=>{
  const {db,sql}=database();
  const seed=readFileSync(new URL('../src/plugins/sably-operations/public-data-seed.sql',import.meta.url),'utf8');
  sql.exec(seed);
  const before=await readPublicReviews(db);assert.equal(before.length,139);
  const item=before[0]!;
  await moderate(db,editor,{entity:'sably_public_review',id:item.id,expectedStatus:'approved',status:'rejected',reason:'Test moderation'});
  assert.equal((await readPublicReviews(db,item.slug)).some(r=>r.id===item.id),false);
  sql.exec(seed);
  assert.equal((await readPublicReviews(db)).length,138);
  assert.equal(sql.prepare('SELECT moderator FROM sably_public_review_log').get()!.moderator,'emdash:test-editor');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM purchase').get()!.n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM lead').get()!.n,0);sql.close();
});
test('operational prices and ratings cache only within a request and preserve currency sanity checks',async()=>{
  const {db,sql}=database();
  sql.exec("INSERT INTO hotmart_precio(slug,moneda,monto) VALUES ('test','USD',50),('test','COP',330000)");
  const scope={};const first=await readOperationalData(db,scope);
  assert.deepEqual(operationalPrice(first,'test',{currency:'COP'}),{monto:50,moneda:'USD',esLocal:false});
  sql.exec("UPDATE hotmart_precio SET monto=165000 WHERE moneda='COP'");
  assert.equal(await readOperationalData(db,scope),first);
  const next=await readOperationalData(db,{});
  assert.deepEqual(operationalPrice(next,'test',{currency:'COP'}),{monto:165000,moneda:'COP',esLocal:true});sql.close();
});
test('SSR comments show only approved threads and suppress approved replies when parent is rejected',async()=>{
  const {db,sql}=database();
  sql.exec("INSERT INTO subject(id,kind,slug) VALUES ('blog:test','blog','test'); INSERT INTO consent(id,purpose,policy_version,policy_url,text_shown,ip_hash) VALUES ('consent-test','comment','v1','/privacy','Synthetic consent','hash'); INSERT INTO comment(id,subject_id,author_name,body,consent_id,ip_hash,status) VALUES ('parent','blog:test','Test Parent','Synthetic parent body','consent-test','hash','approved'); INSERT INTO comment(id,subject_id,parent_id,author_name,body,consent_id,ip_hash,status) VALUES ('reply','blog:test','parent','Test Reply','Synthetic reply body','consent-test','hash','approved');");
  const thread=await readPublicComments(db,'blog:test');assert.equal(thread.length,1);assert.equal(thread[0]!.respuestas!.length,1);
  await moderate(db,editor,{entity:'comment',id:'parent',expectedStatus:'approved',status:'rejected',reason:'Test'});
  assert.deepEqual(await readPublicComments(db,'blog:test'),[]);sql.close();
});
