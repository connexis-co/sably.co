import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {dispatchLegacyApi} from '../src/lib/legacy-backend';
import {moderate} from '../src/plugins/sably-operations/service';
import {readPublicComments} from '../src/plugins/sably-operations/public';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
 sql.exec("INSERT INTO subject(id,kind,slug,is_active) VALUES ('blog:sample','blog','sample',1),('blog:other','blog','other',1),('blog:closed','blog','closed',0),('course:sample','course','sample',1)");
 const db={prepare(query:string){let values:any[]=[];const statement={bind(...v:any[]){values=v;return statement;},async first(){return sql.prepare(query).get(...values)??null;},async all(){return{results:sql.prepare(query).all(...values)};},async run(){return{meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}};return statement;},async batch(statements:any[]){sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 const call=(path:string,body?:unknown)=>dispatchLegacyApi(new Request(`https://dev.sably.co/api/${path}`,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{body:JSON.stringify(body)})}),{SABLY_ENVIRONMENT:'development',SABLY_DB:db,SABLY_IP_SALT:'test-only'},path.split('?')[0]!);
 const payload={subject:'blog:sample',author_name:'Prueba sintética',author_email:'private@example.invalid',body:'Texto de prueba <script>alert(1)</script>',consent_text:'Consentimiento de prueba',abierto_ms:5000,trampa:''};
 const change=(id:string,from:string,to:string)=>moderate(db,{id:'test-editor',role:40},{entity:'comment',id,expectedStatus:from,status:to,reason:'Prueba de integración'});
 return{sql,db,call,payload,change};
}
test('blog submissions enter native moderation; public API and SSR only show approved threads without email',async()=>{
 const f=fixture();
 assert.equal((await f.call('v1/comentarios',f.payload)).status,201);
 const id=String(f.sql.prepare('SELECT id FROM comment').get()!.id);
 assert.equal((await f.call('v1/comentarios?subject=blog:sample').then(r=>r.json()) as any).total,0);
 assert.deepEqual(await readPublicComments(f.db,'blog:sample'),[]);
 assert.equal((await f.call('v1/comentario-voto',{comment_id:id,visitor_id:'visitor-test',value:1})).status,422);
 await f.change(id,'pending','approved');
 const data=await f.call('v1/comentarios?subject=blog:sample').then(r=>r.json()) as any;
 assert.equal(data.total,1);assert.equal(data.comentarios[0].body,f.payload.body);
 assert.doesNotMatch(JSON.stringify(data),/private@example|author_email|ip_hash|consent_id/);
 assert.equal((await readPublicComments(f.db,'blog:sample'))[0]!.id,id);
 assert.equal((await f.call('v1/comentario-voto',{comment_id:id,visitor_id:'visitor-test',value:1}).then(r=>r.json()) as any).utiles,1);
 assert.equal((await f.call('v1/comentarios',{...f.payload,parent_id:id,body:'Respuesta de prueba moderada'})).status,201);
 const reply=String(f.sql.prepare('SELECT id FROM comment WHERE parent_id IS NOT NULL').get()!.id);
 assert.equal((await readPublicComments(f.db,'blog:sample'))[0]!.respuestas!.length,0);
 await f.change(reply,'pending','approved');
 assert.equal((await readPublicComments(f.db,'blog:sample'))[0]!.respuestas!.length,1);
 await f.change(id,'approved','rejected');
 assert.equal((await f.call('v1/comentarios?subject=blog:sample').then(r=>r.json()) as any).total,0);
 assert.deepEqual(await readPublicComments(f.db,'blog:sample'),[]);f.sql.close();
});
test('unpublishing an article hides its comments and prevents new comments or votes',async()=>{
 const f=fixture();await f.call('v1/comentarios',f.payload);const id=String(f.sql.prepare('SELECT id FROM comment').get()!.id);await f.change(id,'pending','approved');
 f.sql.exec("UPDATE subject SET is_active=0 WHERE id='blog:sample'");
 assert.deepEqual(await readPublicComments(f.db,'blog:sample'),[]);
 assert.equal((await f.call('v1/comentarios?subject=blog:sample')).status,404);
 assert.equal((await f.call('v1/comentarios',f.payload)).status,404);
 assert.equal((await f.call('v1/comentario-voto',{comment_id:id,visitor_id:'visitor-test',value:1})).status,422);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM comment').get()!.n,1);f.sql.close();
});
test('invalid payloads and replies to hidden or unrelated comments fail without storing consent',async()=>{
 const f=fixture();
 for(const body of [null,{}, {...f.payload,body:5},{...f.payload,author_email:'invalid\nemail'}])assert.equal((await f.call('v1/comentarios',body)).status,400);
 for(const subject of ['blog:missing','blog:closed','course:sample'])assert.equal((await f.call('v1/comentarios',{...f.payload,subject})).status,404);
 await f.call('v1/comentarios',f.payload);const id=String(f.sql.prepare('SELECT id FROM comment').get()!.id);
 assert.equal((await f.call('v1/comentarios',{...f.payload,parent_id:id})).status,422);
 await f.change(id,'pending','approved');assert.equal((await f.call('v1/comentarios',{...f.payload,subject:'blog:other',parent_id:id})).status,422);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM consent').get()!.n,1);f.sql.close();
});
