/** Warm global copies first, then the edge, allowing KV propagation between phases. */
export async function warmPublicTargets({targets,pageUrls,concurrency=3,headers,fetchPublic=fetch,onProgress=()=>{}}){
 if(!Number.isInteger(concurrency)||concurrency<1)throw new Error('Warm concurrency must be a positive integer');
 const pages=new Set(pageUrls),global=new Map();
 async function request(url){
  const started=performance.now();
  try{
   const response=await fetchPublic(url,{headers,redirect:'manual',signal:AbortSignal.timeout(60000)});
   await response.arrayBuffer();
   return {status:response.status,store:response.headers.get('x-sably-store'),cache:response.headers.get('cf-cache-status'),ms:Math.round(performance.now()-started)};
  }catch(error){return {status:0,error:error.message,ms:Math.round(performance.now()-started)};}
 }
 async function phase(name,urls,run){
  const rows=[];let next=0;
  async function worker(){while(next<urls.length){const url=urls[next++];rows.push(await run(url));if(rows.length%50===0)await onProgress({phase:name,completed:rows.length,total:urls.length,rows:[...rows]});}}
  await Promise.all(Array.from({length:Math.min(concurrency,urls.length)},worker));
  await onProgress({phase:name,completed:rows.length,total:urls.length,rows:[...rows]});
  return rows;
 }
 const shared=await phase('shared',targets.filter(url=>!pages.has(url)),async url=>({url,...await request(url)}));
 await phase('global',targets.filter(url=>pages.has(url)),async url=>{
  const tracked=new URL(url);tracked.searchParams.set('utm_source','sably-cache-warmup');
  const result={url,...await request(tracked.href)};global.set(url,result);return result;
 });
 const edge=await phase('edge',targets.filter(url=>pages.has(url)),async url=>{
  const result=await request(url),first=global.get(url);
  return {url,...result,store:first.store,globalStatus:first.status,globalError:first.error,globalMs:first.ms,edgeMs:result.ms,ms:first.ms+result.ms};
 });
 return [...shared,...edge];
}
