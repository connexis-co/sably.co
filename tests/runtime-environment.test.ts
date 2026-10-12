import assert from 'node:assert/strict';
import test from 'node:test';
import { gateEnvironment,protectEnvironmentResponse } from '../src/lib/runtime-environment.ts';
test('development stays gated even under a production hostname',async()=>{
 const result=await gateEnvironment(new Request('https://sably.co/'),{SABLY_ENVIRONMENT:'development',SABLY_DEV_PASSWORD:'test-secret'});
 assert.equal(result?.status,401);assert.match(result!.headers.get('X-Robots-Tag')!,/noindex/);
});
test('development lets crawlers read its disallow-all robots.txt and keeps every other path gated',async()=>{
 const env={SABLY_ENVIRONMENT:'development',SABLY_DEV_PASSWORD:'test-secret'};
 for(const method of ['GET','HEAD']){
  const robots=await gateEnvironment(new Request('https://dev.sably.co/robots.txt',{method}),env);
  assert.equal(robots?.status,200);assert.equal(robots!.headers.get('WWW-Authenticate'),null);assert.match(robots!.headers.get('X-Robots-Tag')!,/noindex/);
  assert.equal(await robots!.text(),method==='GET'?'User-agent: *\nDisallow: /\n':'');
 }
 for(const request of [new Request('https://dev.sably.co/robots.txt',{method:'POST'}),new Request('https://dev.sably.co/robots.txt/'),new Request('https://dev.sably.co/co/robots.txt'),new Request('https://dev.sably.co/sitemap-index.xml')])
  assert.equal((await gateEnvironment(request,env))?.status,401);
 assert.equal((await gateEnvironment(new Request('https://dev.sably.co/robots.txt'),{SABLY_ENVIRONMENT:'development'}))?.status,200);
 assert.equal(await gateEnvironment(new Request('https://sably.co/robots.txt'),{SABLY_ENVIRONMENT:'production'}),null);
});
test('production responses keep editorial headers and have no staging gate',async()=>{
 assert.equal(await gateEnvironment(new Request('https://sably.co/'),{SABLY_ENVIRONMENT:'production'}),null);
 const response=protectEnvironmentResponse(new Response('ok',{headers:{'Cache-Control':'public, max-age=60'}}),{SABLY_ENVIRONMENT:'production'});
 assert.equal(response.headers.get('WWW-Authenticate'),null);assert.equal(response.headers.get('X-Robots-Tag'),null);assert.equal(response.headers.get('Cache-Control'),'public, max-age=60');
});
test('missing or misspelled environment fails closed',async()=>{
 for(const value of [undefined,'prod','staging'])assert.equal((await gateEnvironment(new Request('https://dev.sably.co/'),{SABLY_ENVIRONMENT:value}))?.status,503);
});

test('production first-owner setup requires its separate secret, including encoded routes',async()=>{
 const DB={prepare:()=>({first:async()=>({count:0})})} as unknown as D1Database;
 const env={SABLY_ENVIRONMENT:'production',DB,SABLY_SETUP_PASSWORD:'test-owner-password'};
 for(const path of ['/_emdash/admin/setup','/_emdash/api/setup','/_emdash/api/setup/admin','/_emdash/api/setup%2Fadmin/verify']){
  const denied=await gateEnvironment(new Request('https://sably.co'+path),env);
  assert.equal(denied?.status,401);assert.match(denied!.headers.get('WWW-Authenticate')!,/initial setup/);
  assert.equal(await gateEnvironment(new Request('https://sably.co'+path,{headers:{Authorization:'Basic '+btoa('sably:test-owner-password')}}),env),null);
 }
 assert.equal(await gateEnvironment(new Request('https://sably.co/_emdash/api/media/file/photo.jpg'),env),null);
 assert.equal(await gateEnvironment(new Request('https://sably.co/_emdash/api/comments'),env),null);
 assert.equal(await gateEnvironment(new Request('https://sably.co/nosotros/'),env),null);
});
test('initial setup fails closed without DB/password and leaves established EmDash auth unchanged',async()=>{
 assert.equal((await gateEnvironment(new Request('https://sably.co/_emdash/api/setup/admin'),{SABLY_ENVIRONMENT:'production'}))?.status,503);
 const DB={prepare:()=>({first:async()=>({count:1})})} as unknown as D1Database;
 assert.equal(await gateEnvironment(new Request('https://sably.co/_emdash/admin/setup'),{SABLY_ENVIRONMENT:'production',DB}),null);
});
