import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildSeed } from '../scripts/emdash-content.mjs';
import { createContentRepository, type CmsEntry, type ContentReader } from '../src/lib/emdash-content.ts';
import * as indexability from '../src/lib/cms-indexability.ts';

const {seed}=await buildSeed('full');
const entries:Record<string,CmsEntry[]>={};
for(const [name,rows] of Object.entries(seed.content) as [string,Array<{id:string;slug:string;status:string;data:Record<string,unknown>}>][]){
  entries[name]=rows.filter(row=>row.status==='published').map(row=>{
    const data={...structuredClone(row.data),id:row.id,slug:row.slug,updatedAt:'2026-10-12T00:00:00Z'} as Record<string,unknown>;
    for(const [key,value] of Object.entries(data))if(Array.isArray(value)&&typeof value[0]==='string'&&value[0].startsWith('$ref:'))data[key]=value[0].slice(5);
    return{id:row.slug,data};
  });
}
const reader:ContentReader={
  async entry(name,slug){return{entry:entries[name]?.find(e=>e.id===slug)??null};},
  async collection(name,query){
    const all=(entries[name]??[]).filter(e=>Object.entries(query.where??{}).every(([k,v])=>(e.data as Record<string,unknown>)[k]===v));
    const offset=Number(query.cursor??0),page=all.slice(offset,offset+query.limit),hasMore=offset+page.length<all.length;
    return{entries:page,hasMore,nextCursor:hasMore?String(offset+page.length):undefined};
  },
};

// Execute the real loaders; only their runtime imports are replaced.
function loadModule(path:string,dependencies:Record<string,unknown>) {
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string,any>={};
  new Function('exports','require',compiled)(exports,(name:string)=>{
    assert.ok(Object.hasOwn(dependencies,name),`Unexpected dependency: ${name}`);
    return dependencies[name];
  });
  return exports;
}
const cms=createContentRepository(reader);
const content={getContentRepository:async()=>cms};
const cityRedirect=loadModule('../src/lib/page-loaders/city-redirect.ts',{'@/lib/emdash-content':content});
const marketItem=loadModule('../src/lib/page-loaders/market-item.ts',{'../cms-indexability':indexability,'@/lib/emdash-content':content,'./city-redirect':cityRedirect});
const context=(path:string,params:Record<string,string>)=>({params,url:new URL(`https://sably.co${path}`),locals:{} as App.Locals,response:{headers:new Headers()}});
const category=(entries.categories??[]).find(c=>!(c.data as Record<string,unknown>).external_url)!.id;
const query='?utm_source=chatgpt.com&utm_medium=referral';

test('city course, catalog and category pages answer one 301 to their country page, keeping the query',async()=>{
  for(const [path,params,route,location] of [
    [`/co/bogota/curso-de-barberia/${query}`,{country:'co',item:'bogota',slug:'curso-de-barberia'},'course',`/co/curso-de-barberia/${query}`],
    [`/mx/cdmx/cursos/${query}`,{country:'mx',item:'cdmx'},'catalog',`/mx/cursos/${query}`],
    [`/es/madrid/cursos/${category}/${query}`,{country:'es',item:'madrid',category},'category',`/es/cursos/${category}/${query}`],
  ] as const){
    const response:Response=await cityRedirect.load(context(path,params),route);
    assert.equal(response.status,301,path);
    assert.equal(response.headers.get('location'),location,path);
  }
});

test('the city hub shares its route with country courses: hubs redirect, courses still render',async()=>{
  const hub=await marketItem.load(context(`/co/bogota/${query}`,{country:'co',item:'bogota'}));
  assert.ok(hub instanceof Response);
  assert.equal(hub.status,301);
  assert.equal(hub.headers.get('location'),`/co/${query}`);
  const course=await marketItem.load(context('/co/curso-de-barberia/',{country:'co',item:'curso-de-barberia'}));
  assert.ok(!(course instanceof Response));
  assert.equal(course.content.course.id,'curso-de-barberia');
});

test('unknown cities, courses or categories stay 404 instead of redirecting to an unrelated page',async()=>{
  for(const [params,route] of [
    [{country:'co',item:'atlantida',slug:'curso-de-barberia'},'course'],
    [{country:'co',item:'bogota',slug:'curso-inexistente'},'course'],
    [{country:'co',item:'bogota',category:'categoria-inexistente'},'category'],
    [{country:'zz',item:'bogota'},'catalog'],
  ] as const){
    const response:Response=await cityRedirect.load(context('/',params),route);
    assert.equal(response.status,404,JSON.stringify(params));
  }
});
