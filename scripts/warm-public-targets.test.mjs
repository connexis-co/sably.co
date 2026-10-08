import assert from 'node:assert/strict';
import {test} from 'node:test';
import {warmPublicTargets} from './warm-public-targets.mjs';
const pages=['https://sably.co/co/','https://sably.co/mx/'];
test('all global pages warm before any canonical fetch; shared APIs are requested once',async()=>{
 const calls=[],progress=[];
 const rows=await warmPublicTargets({targets:['https://sably.co/api/v1/config',...pages],pageUrls:pages,concurrency:2,onProgress:p=>progress.push(p),fetchPublic:async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');
  return new Response('public',{headers:{'x-sably-store':url.includes('?')?'MISS':'HIT'}});
 }});
 assert.deepEqual(calls,['https://sably.co/api/v1/config',...pages.map(u=>u+'?utm_source=sably-cache-warmup'),...pages]);
 assert.equal(rows.length,3);assert.equal(rows[1].globalStatus,200);assert.equal(rows[1].store,'MISS');
 assert.deepEqual(progress.map(p=>p.phase),['shared','global','edge']);
});
test('a successful canonical response preserves failure of the global warm-up',async()=>{
 const rows=await warmPublicTargets({targets:pages,pageUrls:pages,fetchPublic:async url=>new Response('public',{status:url.includes('?')?503:200})});
 assert(rows.every(r=>r.status===200&&r.globalStatus===503));
});
test('a failed request is recorded while the remaining pages continue warming',async()=>{
 const rows=await warmPublicTargets({targets:pages,pageUrls:pages,fetchPublic:async url=>{
  if(url===pages[0]+'?utm_source=sably-cache-warmup')throw new Error('network unavailable');
  return new Response('public');
 }});
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.url===pages[0]).globalStatus,0);assert.equal(rows.find(r=>r.url===pages[0]).globalError,'network unavailable');assert.equal(rows.find(r=>r.url===pages[1]).globalStatus,200);
});
