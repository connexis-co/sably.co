import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedHotmartUrl,fetchHotmart,loadPublishedHotmartCatalog,retainPublishedCaptures } from '../src/lib/hotmart-catalog.mjs';

test('Hotmart fetch validates every redirect and never sends a request to a foreign/private host',async()=>{
  for(const url of ['http://go.hotmart.com/AAA','https://go.hotmart.com.evil.test/AAA','https://user:pass@pay.hotmart.com/AAA','https://127.0.0.1/AAA','https://pay.hotmart.com/PENDIENTE'])assert.equal(allowedHotmartUrl(url),false,url);
  const calls=[];
  await assert.rejects(()=>fetchHotmart('https://go.hotmart.com/AAA',{fetcher:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest'}});}}),/no permitida/);
  assert.deepEqual(calls,['https://go.hotmart.com/AAA']);
  const result=await fetchHotmart('https://hotm.art/AAA',{fetcher:async url=>url.includes('hotm.art')?new Response(null,{status:302,headers:{location:'https://pay.hotmart.com/AAA'}}):new Response('safe checkout')});
  assert.equal(result.final,'https://pay.hotmart.com/AAA');assert.equal(result.html,'safe checkout');
  const marketplaceFetch=async url=>url.includes('go.hotmart.com')?new Response(null,{status:302,headers:{location:'https://hotmart.com/es/marketplace/products/course/123'}}):new Response('"productId":123456');
  await assert.rejects(()=>fetchHotmart('https://go.hotmart.com/AAA?dp=1',{fetcher:marketplaceFetch}),/no permitida/);
  assert.equal((await fetchHotmart('https://go.hotmart.com/AAA?dp=1',{marketplace:true,fetcher:marketplaceFetch})).html,'"productId":123456');
});
test('refresher gets published CMS catalog with scoped credentials and cannot fall back to local MDX',async()=>{
  const calls=[];
  const courses=[{slug:'new-cms-course',titulo:'Nuevo',url:'https://go.hotmart.com/NEW'}];
  assert.deepEqual(await loadPublishedHotmartCatalog({api:'https://dev.sably.co',token:'snapshot',previewToken:'preview',fetcher:async(url,options)=>{calls.push(url);assert.equal(options.headers.authorization,'Bearer snapshot');assert.equal(options.headers['X-Sably-Preview-Token'],'preview');assert.equal(options.redirect,'error');return Response.json({source:'emdash',courses});}}),courses);
  await assert.rejects(()=>loadPublishedHotmartCatalog({api:'https://evil.example',token:'secret',fetcher:async()=>{throw new Error('must not call');}}),/SABLY_API/);
  await assert.rejects(()=>loadPublishedHotmartCatalog({api:'https://sably.co',token:'secret',fetcher:async()=>new Response(null,{status:503})}),/503/);
  assert.equal(calls.length,1);
});
test('local captures remove unpublished or changed-source facts and preserve unchanged courses',()=>{
  const snapshot={_sourceUrls:{keep:'https://go.hotmart.com/A',edit:'https://go.hotmart.com/OLD',removed:'https://go.hotmart.com/C'},precios:{keep:{USD:49},edit:{USD:99},removed:{USD:10}},productos:{keep:{payUrl:'https://pay.hotmart.com/A'},edit:{payUrl:'https://pay.hotmart.com/OLD'}},valoraciones:{removed:{rating:5}},resenas:{edit:[]}};
  retainPublishedCaptures(snapshot,[{slug:'keep',url:'https://go.hotmart.com/A'},{slug:'edit',url:'https://go.hotmart.com/NEW'}]);
  assert.deepEqual(snapshot.precios,{keep:{USD:49}});assert.deepEqual(snapshot.valoraciones,{});assert.deepEqual(snapshot.resenas,{});
});
