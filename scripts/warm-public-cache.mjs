import {mkdir,writeFile} from 'node:fs/promises';

/**
 * Post-deploy warm-up. Each Worker version starts with an empty Workers Cache,
 * so the first visitor of every page would pay the full EmDash render. This
 * requests every sitemap page and the two shared APIs once, anonymously, from
 * the runner. It fills the cache tiers serving the runner's region and EmDash's
 * KV object cache, so later renders elsewhere start warmer; colos far away
 * still fill on their first visit. It only reads public URLs and never fails
 * the deployment.
 */
const ORIGIN=process.env.SABLY_WARM_ORIGIN??'https://sably.co';
// D1 runs one query at a time per database: more parallel renders only queue behind each other.
const CONCURRENCY=Number(process.env.SABLY_WARM_CONCURRENCY??3);
const headers={'user-agent':'SablyCacheWarmer/1.0 (+https://sably.co)',accept:'text/html,application/json'};

const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
async function text(url){
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`${url}: ${response.status}`);
 return response.text();
}

const index=locs(await text(`${ORIGIN}/sitemap-index.xml`)).filter(url=>url.startsWith(`${ORIGIN}/`));
const pages=new Set([`${ORIGIN}/co/`]);
for(const sitemap of index){
 try{for(const url of locs(await text(sitemap)))if(url.startsWith(`${ORIGIN}/`)&&url.endsWith('/'))pages.add(url);}
 catch(error){console.error(`Skipped sitemap ${sitemap}: ${error.message}`);}
}
// Highest-traffic first, in case the step is cut short: country homes and catalogs, then Colombia.
const rank=url=>{const path=new URL(url).pathname;return /^\/[a-z]{2}\/(?:cursos\/)?$/.test(path)?0:path.startsWith('/co/')?1:2;};
const targets=[`${ORIGIN}/api/v1/promo`,`${ORIGIN}/api/v1/config`,...[...pages].sort((a,b)=>rank(a)-rank(b))];

const rows=[];let next=0;
async function worker(){
 while(next<targets.length){
  const url=targets[next++];const started=performance.now();
  try{
   const response=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(60000)});
   await response.arrayBuffer();
   rows.push({url,status:response.status,cache:response.headers.get('cf-cache-status'),ms:Math.round(performance.now()-started)});
  }catch(error){rows.push({url,status:0,error:error.message,ms:Math.round(performance.now()-started)});}
 }
}
await Promise.all(Array.from({length:Math.min(CONCURRENCY,targets.length)},worker));

const ms=rows.map(r=>r.ms).sort((a,b)=>a-b);
const at=p=>ms[Math.min(ms.length-1,Math.floor(p*ms.length))]??0;
const count=key=>Object.fromEntries(Object.entries(Object.groupBy(rows,r=>String(r[key]))).map(([k,v])=>[k,v.length]));
const summary={checkedAt:new Date().toISOString(),origin:ORIGIN,requested:rows.length,status:count('status'),cache:count('cache'),p50:at(.5),p95:at(.95),failures:rows.filter(r=>r.status!==200).slice(0,50)};
await mkdir('dist',{recursive:true});
await writeFile('dist/cache-warm.json',JSON.stringify({...summary,rows},null,2));
console.log(JSON.stringify(summary));
