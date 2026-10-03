import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

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
await mkdir('dist',{recursive:true});
await writeFile('dist/production-seo-probe.json',JSON.stringify({checkedAt:new Date().toISOString(),rows},null,2));
console.log(JSON.stringify({checked:rows.length,result:'passed',rows}));
