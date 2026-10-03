import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { reconcileCatalog } from '../src/plugins/sably-operations/catalog.ts';
import { catalogResponse,validateCaptureRequest } from '../src/plugins/sably-operations/catalog-api.ts';

function adapter(sql: DatabaseSync) {
  const prepare=(query:string)=>{
    let values:any[]=[];
    const statement={bind:(...v:any[])=>{values=v;return statement;},run:async()=>({success:true,results:[],meta:{changes:Number(sql.prepare(query).run(...values).changes)}}),all:async()=>({success:true,results:sql.prepare(query).all(...values),meta:{}}),first:async()=>sql.prepare(query).get(...values)??null};
    return statement;
  };
  return {prepare,batch:async(statements:any[])=>{sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
}
function fixture() {
  const cms=new DatabaseSync(':memory:'),ops=new DatabaseSync(':memory:');
  cms.exec(`CREATE TABLE ec_courses(id TEXT,slug TEXT,title TEXT,hotmart_url TEXT,locale TEXT,status TEXT,deleted_at TEXT);
    CREATE TABLE ec_blog(id TEXT,slug TEXT,title TEXT,locale TEXT,status TEXT,deleted_at TEXT);
    INSERT INTO ec_courses VALUES ('c1','curso-uno','Curso uno','https://go.hotmart.com/AAA','es','published',NULL),('c2','curso-draft','Draft','https://go.hotmart.com/BBB','es','draft',NULL);
    INSERT INTO ec_blog VALUES ('b1','post-uno','Post uno','es','published',NULL);`);
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) ops.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
  ops.exec(readFileSync(new URL('../src/plugins/sably-operations/migration.sql',import.meta.url),'utf8'));
  return {cms,ops,DB:adapter(cms),SABLY_DB:adapter(ops)};
}
test('CMS publish creates course/blog subjects; drafts stay excluded and later publication requires no build',async()=>{
  const f=fixture();
  assert.deepEqual(await reconcileCatalog(f.DB,f.SABLY_DB),[{slug:'curso-uno',titulo:'Curso uno',url:'https://go.hotmart.com/AAA'}]);
  assert.deepEqual(f.ops.prepare('SELECT id FROM subject WHERE is_active=1 ORDER BY id').all().map(r=>r.id),['blog:post-uno','course:curso-uno']);
  f.cms.exec("UPDATE ec_courses SET status='published',title='Nueva alta' WHERE id='c2'");
  const next=await reconcileCatalog(f.DB,f.SABLY_DB);assert.equal(next.find(r=>r.slug==='curso-draft')?.titulo,'Nueva alta');
  assert.equal(f.ops.prepare("SELECT is_active FROM subject WHERE id='course:curso-draft'").get()!.is_active,1);
});
test('edits use live title/URL; URL changes invalidate disposable facts and unpublish preserves historical subject',async()=>{
  const f=fixture();await reconcileCatalog(f.DB,f.SABLY_DB);
  f.ops.exec("INSERT INTO hotmart_producto(slug,pay_url) VALUES ('curso-uno','https://pay.hotmart.com/OLD'); INSERT INTO hotmart_precio(slug,moneda,monto) VALUES('curso-uno','USD',50); INSERT INTO hotmart_valoracion(slug,rating,total) VALUES ('curso-uno',5,2)");
  f.cms.exec("UPDATE ec_courses SET title='Editado',hotmart_url='https://go.hotmart.com/NEW' WHERE id='c1'");
  assert.equal((await reconcileCatalog(f.DB,f.SABLY_DB))[0]!.titulo,'Editado');
  assert.equal(f.ops.prepare('SELECT COUNT(*) n FROM hotmart_producto').get()!.n,0);
  assert.equal(f.ops.prepare('SELECT COUNT(*) n FROM hotmart_precio').get()!.n,0);
  assert.equal(f.ops.prepare('SELECT COUNT(*) n FROM hotmart_valoracion').get()!.n,0);
  f.cms.exec("UPDATE ec_courses SET status='draft' WHERE id='c1'");await reconcileCatalog(f.DB,f.SABLY_DB);
  assert.equal(f.ops.prepare("SELECT is_active FROM subject WHERE id='course:curso-uno'").get()!.is_active,0);
  f.cms.exec("UPDATE ec_courses SET status='published',slug='curso-renombrado' WHERE id='c1'");await reconcileCatalog(f.DB,f.SABLY_DB);
  assert.equal(f.ops.prepare("SELECT is_active FROM subject WHERE id='course:curso-renombrado'").get()!.is_active,1);
  f.cms.exec("DELETE FROM ec_courses WHERE id='c1'");await reconcileCatalog(f.DB,f.SABLY_DB);
  assert.equal(f.ops.prepare("SELECT is_active FROM subject WHERE id='course:curso-renombrado'").get()!.is_active,0);
});
test('catalog endpoint authenticates before queries and applies independent production activation guards',async()=>{
  const f=fixture(),env={...f,SABLY_ENVIRONMENT:'development',SABLY_SNAPSHOT_TOKEN:'test-secret'};
  const request=(origin='https://dev.sably.co',token='test-secret')=>new Request(`${origin}/api/v1/catalogo`,{headers:{authorization:`Bearer ${token}`}});
  assert.equal((await catalogResponse(request('https://dev.sably.co','wrong'),env)).status,401);
  const result=await catalogResponse(request(),env);assert.equal(result.status,200);assert.match(result.headers.get('x-robots-tag')!,/noindex/);
  assert.equal((await result.json()).courses.length,1);
  assert.equal((await catalogResponse(request('https://sably.co'),{...env,SABLY_ENVIRONMENT:'production'})).status,503);
  assert.equal((await catalogResponse(request('https://sably.co'),{...env,SABLY_ENVIRONMENT:'production',SABLY_CMS_READY:'true',SABLY_PRODUCTION_ACTIVATED:'true'})).status,200);
});
test('capture submission rejects unpublished/edited sources and foreign checkouts before any write',async()=>{
  const f=fixture(),env={...f,SABLY_ENVIRONMENT:'development',SABLY_SNAPSHOT_TOKEN:'test-secret'};
  const request=(source='https://go.hotmart.com/AAA',pay='https://pay.hotmart.com/REAL')=>new Request('https://dev.sably.co/api/v1/precios',{method:'POST',headers:{authorization:'Bearer test-secret','content-type':'application/json'},body:JSON.stringify({sources:{'curso-uno':source},productos:[{slug:'curso-uno',payUrl:pay}],precios:[{slug:'curso-uno',moneda:'USD',monto:49}]})});
  assert.ok(await validateCaptureRequest(request(),env) instanceof Request);
  assert.equal((await validateCaptureRequest(request('https://go.hotmart.com/OLD'),env) as Response).status,409);
  assert.equal((await validateCaptureRequest(request('https://go.hotmart.com/AAA','https://evil.example/REAL'),env) as Response).status,400);
  f.cms.exec("UPDATE ec_courses SET status='draft' WHERE id='c1'");
  assert.equal((await validateCaptureRequest(request(),env) as Response).status,409);
  assert.equal(f.ops.prepare('SELECT COUNT(*) n FROM hotmart_precio').get()!.n,0);
});
