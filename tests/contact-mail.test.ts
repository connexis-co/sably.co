import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost } from '../functions/api/v1/leads.ts';
import { contactCsv,contactCsvCell } from '../src/plugins/sably-operations/contact-export.ts';
import { resolveOperationalMail } from '../src/lib/operational-mail.ts';
import { listLeads } from '../src/plugins/sably-operations/service.ts';
import { createPlugin } from '../src/plugins/sably-operations/index.ts';
import { definePlugin, HookPipeline } from 'emdash';

function database() {
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));
  const db={prepare(query:string){let values:any[]=[];const statement={bind(...v:any[]){values=v;return statement;},async run(){return{success:true,meta:{changes:Number(sql.prepare(query).run(...values).changes)}};},async first(){return sql.prepare(query).get(...values)??null;},async all(){return{success:true,results:sql.prepare(query).all(...values)};}};return statement;},batch:async()=>[]} as unknown as D1Database;
  return{sql,db};
}
test('contact double submit including no course saves one lead and notifies the team once',async(t)=>{
  const outbound=t.mock.method(globalThis,'fetch',async()=>{throw new Error('Unexpected HTTP mail request');});
  const f=database(),sent:any[]=[];
  const env={DB:f.db,MAIL:{notificationEmail:'team@example.invalid',send:async(message:any)=>{sent.push(message);}}};
  for(const course of [undefined,'curso-nuevo']) {
    const submit=()=>onRequestPost({env,request:new Request('https://sably.co/api/v1/leads',{method:'POST',body:JSON.stringify({name:'Contacto sintético',email:'customer@example.invalid',phone:'+5712345',course_interest:course,consent_text:'Consentimiento sintético',abierto_ms:4000})})} as any);
    const first=await submit(),second=await submit();
    assert.equal(first.status,201);assert.equal(second.status,200);
    const one=await first.json() as any,two=await second.json() as any;
    assert.equal(one.correo,false);assert.equal(one.equipo_notificado,true);assert.doesNotMatch(one.mensaje,/enviamos.*correo/);
    assert.equal(two.duplicado,true);assert.equal(two.equipo_notificado,false);
  }
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM lead').get()!.n,2);assert.equal(sent.length,2);
  assert.ok(sent.every(message=>message.to==='team@example.invalid'&&message.replyTo==='customer@example.invalid'));
  assert.equal(outbound.mock.callCount(),0);f.sql.close();
});
test('a failed or unavailable provider never loses a saved contact or reports visitor mail',async()=>{
  const f=database();
  const response=await onRequestPost({env:{DB:f.db},request:new Request('https://sably.co/api/v1/leads',{method:'POST',body:JSON.stringify({name:'Contacto sintético',email:'customer@example.invalid',consent_text:'Consentimiento sintético'})})} as any);
  assert.equal(response.status,201);const data=await response.json() as any;assert.equal(data.guardado,true);assert.equal(data.correo,false);assert.equal(data.equipo_notificado,false);f.sql.close();
});
test('provider failure keeps the contact and reports that the team was not notified',async(t)=>{
  t.mock.method(console,'error',()=>{});
  const f=database();
  const response=await onRequestPost({env:{DB:f.db,MAIL:{notificationEmail:'team@example.invalid',send:async()=>{throw new Error('Synthetic provider failure');}}},request:new Request('https://sably.co/api/v1/leads',{method:'POST',body:JSON.stringify({name:'Contacto sintético',email:'customer@example.invalid',consent_text:'Consentimiento sintético'})})} as any);
  assert.equal(response.status,201);const data=await response.json() as any;assert.equal(data.guardado,true);assert.equal(data.equipo_notificado,false);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM lead').get()!.n,1);f.sql.close();
});
test('CSV preserves full contact fields, quotes and newlines while neutralizing spreadsheet formulas',()=>{
  for(const dangerous of ['=SUM(1,2)',' +cmd','\t@SUM(1)','\uFEFF-1','\n123'])assert.ok(contactCsvCell(dangerous).startsWith('"\''),dangerous);
  const csv=contactCsv([{name:'Ana "Prueba"',email:'ana@example.invalid',phone:'+5712345',source:'Contacto\nmensaje: hola',text_shown:'Texto sintético'}]);
  assert.ok(csv.includes('"email","phone"'));assert.ok(csv.includes('ana@example.invalid'));assert.ok(csv.includes('"Ana ""Prueba"""'));assert.ok(csv.includes('"Contacto\nmensaje: hola"'));
});
test('official pipeline uses explicit settings and is unreachable in development or inactive production',async()=>{
  const f=database(),sent:any[]=[],reads:string[]=[];
  const runtime={email:{isAvailable:()=>true,send:async(message:any,source:string)=>{sent.push({message,source});}},settings:{get:async<T>(key:string)=>{reads.push(key);return 'team@example.invalid' as T;}}};
  const base={SABLY_DB:f.db,SABLY_ENVIRONMENT:'production',SABLY_CMS_READY:'true',SABLY_PRODUCTION_ACTIVATED:'true'};
  assert.equal(await resolveOperationalMail({...base,SABLY_ENVIRONMENT:'development'},'https://dev.sably.co',runtime),undefined);
  assert.equal(await resolveOperationalMail({...base,SABLY_PRODUCTION_ACTIVATED:'false'},'https://sably.co',runtime),undefined);assert.equal(reads.length,0);
  assert.equal(await resolveOperationalMail(base,'https://sably.co',{...runtime,settings:{get:async()=>null}}),undefined);
  const mail=await resolveOperationalMail(base,'https://sably.co',runtime);assert.equal(mail?.notificationEmail,'team@example.invalid');
  await mail!.send({to:mail!.notificationEmail,subject:'Synthetic',text:'Synthetic test'});
  assert.deepEqual(reads,['plugin:sably-operations:settings:notificationEmail']);assert.equal(sent[0].source,'sably-operations');f.sql.close();
});
test('installed EmDash GET parser preserves country/course/offset through a real second page of contacts',async()=>{
  const {parseDeclaredPluginRouteInput}=await import('../node_modules/emdash/src/plugins/route-wire.ts');
  const f=database();
  f.sql.exec("INSERT INTO consent(id,purpose,policy_version,policy_url,text_shown,ip_hash) VALUES('fixture-consent','lead','test','/legal/privacidad/','Synthetic consent','test-hash')");
  const insert=f.sql.prepare("INSERT INTO lead(id,name,email,country,course_interest,consent_id,ip_hash) VALUES(?,?,?,?,?,'fixture-consent','test-hash')");
  for(let i=0;i<105;i++)insert.run(`lead-${String(i).padStart(3,'0')}`,'Synthetic Contact',`contact-${i}@example.invalid`,i===104?'mx':'co',i===103?'other-course':'curso-nuevo');
  const route=createPlugin().routes.leads!;
  const parse=(query:string)=>parseDeclaredPluginRouteInput(new Request(`https://dev.sably.co/_emdash/api/plugins/sably-operations/leads?${query}`),route.request!);
  const first=await listLeads(f.db,{id:'admin-test',role:50},await parse('country=co&course=curso-nuevo&offset=0'));
  const second=await listLeads(f.db,{id:'admin-test',role:50},await parse('country=co&course=curso-nuevo&offset=100'));
  assert.equal(first.items.length,100);assert.equal(first.hasMore,true);assert.equal(second.items.length,3);assert.equal(second.hasMore,false);assert.equal(second.offset,100);
  assert.equal(new Set([...first.items,...second.items].map(row=>row.id)).size,103);
  assert.deepEqual(await parse(''),{});f.sql.close();
});
test('installed EmailPipeline delivers only through the selected native provider and carries the explicit destination',async()=>{
  const {EmailPipeline}=await import('../node_modules/emdash/src/plugins/email.ts');
  const sent:any[]=[];
  const provider=(id:string)=>definePlugin({id,version:'1.0.0',capabilities:['hooks.email-transport:register'],hooks:{'email:deliver':{exclusive:true,handler:async(event)=>{sent.push({id,...event});}}}});
  // These fixture providers only deliver to memory; the native context does not query storage.
  const hooks=new HookPipeline([provider('provider-one'),provider('provider-two')],{db:{} as any});
  const email=new EmailPipeline(hooks),f=database();
  const bindings={SABLY_DB:f.db,SABLY_ENVIRONMENT:'production',SABLY_CMS_READY:'true',SABLY_PRODUCTION_ACTIVATED:'true'};
  const runtime={email,settings:{get:async<T>()=>'explicit-team@example.invalid' as T}};
  assert.equal(await resolveOperationalMail(bindings,'https://sably.co',runtime),undefined);
  hooks.setExclusiveSelection('email:deliver','provider-two');
  const mail=await resolveOperationalMail(bindings,'https://sably.co',runtime);
  await mail!.send({to:mail!.notificationEmail,subject:'Synthetic test',text:'No external delivery'});
  assert.equal(sent.length,1);assert.equal(sent[0].id,'provider-two');assert.equal(sent[0].message.to,'explicit-team@example.invalid');assert.equal(sent[0].source,'sably-operations');f.sql.close();
});
