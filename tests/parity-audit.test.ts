import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildSeed } from '../scripts/emdash-content.mjs';
import { createContentRepository, type CmsEntry, type ContentReader } from '../src/lib/emdash-content.ts';
import { COURSE_VIDEOS } from '../src/lib/course-videos.ts';
import * as indexability from '../src/lib/cms-indexability.ts';
import * as pagePath from '../src/lib/page-path.ts';

const snapshot=JSON.parse(readFileSync(new URL('../docs/parity-sitemap-snapshot.json',import.meta.url),'utf8')) as {sitemaps:Array<{source:string;paths:string[]}>};
const {seed}=await buildSeed('full');

function fixture() {
  const entries:Record<string,CmsEntry[]>={};
  for(const [name,rows] of Object.entries(seed.content) as [string,Array<{id:string;slug:string;status:string;data:Record<string,unknown>}>][]){
    entries[name]=rows.filter(row=>row.status==='published').map(row=>{
      const data={...structuredClone(row.data),id:row.id,slug:row.slug,updatedAt:'2026-10-03T00:00:00Z'} as Record<string,unknown>;
      // Resolved native references are IDs, not the seed's $ref notation.
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
  return{entries,cms:createContentRepository(reader)};
}

function sitemapModule(cms:ReturnType<typeof createContentRepository>) {
  // Execute the real sitemap module; only runtime dependencies are replaced.
  // This avoids maintaining a second route-generation algorithm in the test.
  const source=readFileSync(new URL('../src/lib/sitemap.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const dependencies:Record<string,unknown>={
    './page-path':pagePath,
    './cms-indexability':indexability,
    './emdash-content':{getContentRepository:async()=>cms},
    './site':{SITE:{url:'https://dev.sably.co'},CDN_URL:'https://cdn.sably.co'},
    './course-videos':{COURSE_VIDEOS},
    './categories':{courseCover:()=>'/image-placeholder.svg'},
  };
  const exports:Record<string,any>={};
  new Function('exports','require',compiled)(exports,(name:string)=>{
    assert.ok(Object.hasOwn(dependencies,name),`Unexpected sitemap dependency: ${name}`);
    return dependencies[name];
  });
  return exports;
}
async function routes(cms:ReturnType<typeof createContentRepository>) {
  const sitemap=sitemapModule(cms),groups:Record<string,string[]>={};
  for(const name of await sitemap.sitemapNames()){
    const urls=await(name==='pages'?sitemap.pagesUrls():name==='categorias'?sitemap.categoriasUrls():name==='blog'?sitemap.blogUrls():sitemap.cursosUrls(name.slice(7)));
    groups[name]=urls.map((entry:{loc:string})=>new URL(entry.loc).pathname);
  }
  return groups;
}
const productionPaths=()=>new Set(snapshot.sitemaps.flatMap(s=>s.paths));

test('all 964 captured production sitemap URLs survive the full CMS route generator',async()=>{
  assert.equal(snapshot.sitemaps.length,11);const previous=productionPaths();assert.equal(previous.size,964);
  const groups=await routes(fixture().cms),next=new Set(Object.values(groups).flat());
  assert.equal(next.size,Object.values(groups).flat().length,'Duplicate CMS sitemap URLs');
  assert.deepEqual([...previous].filter(path=>!next.has(path)),[]);
  assert.equal(groups.blog!.length,11);assert.equal(groups.categorias!.length,96);
  for(const [name,paths] of Object.entries(groups))if(name.startsWith('cursos-'))assert.equal(paths.length,104,name);
  const added=[...next].filter(path=>!previous.has(path));
  assert.equal(added.length,17);assert.equal(added.filter(path=>path.includes('/creadores/')).length,16);assert.ok(added.includes('/contacto/'));
});

test('courses without checkout stay outside the sitemap and blog/course slugs remain identical',async()=>{
  const groups=await routes(fixture().cms);
  for(const prior of snapshot.sitemaps.filter(s=>/sitemap-(cursos-|blog)/.test(s.source))){
    const name=prior.source.split('/').at(-1)!.replace(/^sitemap-/,'').replace(/\.xml$/,'');
    assert.deepEqual([...groups[name]!].sort(),[...prior.paths].sort(),name);
  }
  const pending=seed.content.courses.filter((c:{data:{hotmart_url:string}})=>/PENDIENTE/i.test(c.data.hotmart_url));
  assert.equal(pending.length,17);assert.ok(pending.every((c:{slug:string})=>Object.values(groups).flat().every(path=>!path.endsWith(`/${c.slug}/`))));
});

test('the comparison catches an unpublished production course instead of hiding a lost slug',async()=>{
  const {entries,cms}=fixture();entries.courses=entries.courses!.filter(e=>e.id!=='curso-de-barberia');
  const next=new Set(Object.values(await routes(cms)).flat());
  const missing=[...productionPaths()].filter(path=>!next.has(path));
  assert.equal(missing.length,8);assert.ok(missing.every(path=>path.endsWith('/curso-de-barberia/')));
});

test('explicit noindex entries do not reappear in generated XML',async()=>{
  const {entries,cms}=fixture();const post=entries.blog![0]!;(post.data as any).seo={noIndex:true};
  const groups=await routes(cms);assert.ok(!groups.blog!.includes(`/blog/${post.id}/`));
});


test('regional SEO exclusions and custom canonicals agree with generated sitemap URLs',async()=>{
 const {entries,cms}=fixture();
 const parent=entries.courses.find(e=>e.id==='curso-de-barberia');
 const variant=entries.course_locales.find(e=>e.id==='curso-de-barberia--co');
 variant.data.seo={noIndex:true};
 const page=entries.pages.find(e=>e.id==='nosotros');page.data.seo={canonical:'https://dev.sably.co/contacto/'};
 const groups=await routes(cms);
 assert.ok(!groups['cursos-co'].includes('/co/curso-de-barberia/'));
 assert.ok(groups['cursos-mx'].includes('/mx/curso-de-barberia/'));
 assert.ok(!groups.pages.includes('/nosotros/'));
 parent.data.seo={noIndex:true};variant.data.seo={noIndex:false};
 const excluded=await routes(cms);assert.ok(!Object.values(excluded).flat().some(path=>path.endsWith('/curso-de-barberia/')));
});
