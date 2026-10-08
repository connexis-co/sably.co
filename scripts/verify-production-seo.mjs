import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import { verifyIndexableHtml } from './verify-indexable-html.mjs';

/** Public post-deploy probe from the runner, independent of the operator's ISP. */
const probes=[
 ['http://sably.co/','https://sably.co/co/'],
 ['http://sably.co/legal/terminos','https://sably.co/legal/terminos/'],
 ['https://www.sably.co/contacto/','https://sably.co/contacto/'],
 ['https://sably.co/cursos/curso-de-unas-semipermanentes','https://sably.co/co/curso-de-unas/'],
];
const rows=[];
for(const [source,expected] of probes){
 let url=source;const chain=[];
 for(let i=0;i<4;i++){
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
  chain.push({url,status:response.status,location:response.headers.get('location')});
  await response.body?.cancel();
  if(response.status===200)break;
  assert.ok([301,308].includes(response.status),`Non-permanent/unexpected redirect: ${url}: ${response.status}`);
  assert.ok(response.headers.get('location'),`Missing destination: ${url}`);
  url=new URL(response.headers.get('location'),url).href;
  assert.equal(new URL(url).hostname,'sably.co',`Offsite redirect from ${source}`);
 }
 assert.equal(url,expected);assert.equal(chain.at(-1)?.status,200);assert.ok(chain.length<=3,`Long redirect chain: ${source}`);
 rows.push({source,expected,chain});
}
const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
async function readPublic(url) {
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,`Public sitemap unavailable: ${url}`);
 return r.text();
}
const children=locs(await readPublic('https://sably.co/sitemap-index.xml'));
const preferred=[];
for(const child of children){
 assert.equal(new URL(child).origin,'https://sably.co');
 const urls=locs(await readPublic(child));assert(urls.length,`Empty sitemap: ${child}`);
 for(const url of urls)assert.equal(new URL(url).origin,'https://sably.co');
 // Every market and content type; all new videos and articles need an explicit check.
 preferred.push(...(/sitemap-(videos|blog)\.xml$/.test(child)?urls:urls.slice(0,1)));
}
preferred.push('https://sably.co/co/','https://sably.co/videos/');
const htmlRows=[];
for(const url of new Set(preferred)){
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 const html=await r.text();
 htmlRows.push(verifyIndexableHtml(url,r.status,r.headers,html));
 if(url==='https://sably.co/co/')assert.match(html,/href=["']\/videos\/["']/,'The home must serve the new version with its video library link');
}
// City content stays public for AI referrals; Google consolidates through canonical alone.
const cityRows=[];
for(const [url,canonical] of [
 ['https://sably.co/ar/cordoba/','https://sably.co/ar/'],
 ['https://sably.co/co/bogota/cursos/','https://sably.co/co/cursos/'],
 ['https://sably.co/us/losangeles/cursos/manualidades/','https://sably.co/us/cursos/manualidades/'],
])for(const bot of ['Googlebot','OAI-SearchBot','ChatGPT-User']){
 const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':bot},signal:AbortSignal.timeout(30000)});
 cityRows.push({...verifyIndexableHtml(url,r.status,r.headers,await r.text(),canonical),bot});
}
await mkdir('dist',{recursive:true});
await writeFile('dist/production-seo-probe.json',JSON.stringify({checkedAt:new Date().toISOString(),rows,indexable:htmlRows,cities:cityRows},null,2));
console.log(JSON.stringify({checked:rows.length,indexable:htmlRows.length,cityBots:cityRows.length,result:'passed',rows}));
