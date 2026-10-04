import assert from 'node:assert/strict';
import {test} from 'node:test';
import service, {createCmsImageService} from '../src/lib/cms-image-service';
import {cloudflareImageUrl} from '../src/lib/cloudflare-images';

test('native R2 assets with nested migration keys bypass the static asset transform endpoint',()=>{
 for(const src of ['/_emdash/api/media/file/migration/a.jpg','https://sably.co/_emdash/api/media/file/migration/a.jpg']){
  assert.equal(service.getURL({src,width:800,height:536},{} as any,{} as any),src);
 }
});

test('production variants preserve the nested native origin and negotiate formats',()=>{
 const production=createCmsImageService('https://sably.co/');
 const options={src:'https://sably.co/_emdash/api/media/file/migration/imagen%20uno.jpg',width:800,height:450};
 const config={endpoint:{route:'/_image'},domains:[],remotePatterns:[]} as any;
 const url=production.getURL(options,config,{} as any);
 assert.match(url,/^\/cdn-cgi\/image\/width=800,quality=80,format=auto,fit=scale-down,onerror=redirect\/_emdash\/api\/media\/file\/migration\/imagen%20uno.jpg$/);
 const set=production.getSrcSet(options,config);
 assert.ok(set.some(s=>s.descriptor==='480w'));
 assert.ok(set.some(s=>s.descriptor==='800w'));
 for(const entry of set){assert.equal(entry.descriptor,`${entry.transform.width}w`);assert.ok(production.getURL(entry.transform,config,{} as any).startsWith('/cdn-cgi/image/'));}
 const attributes=production.getHTMLAttributes({...options,fetchpriority:'high'},config);
 assert.equal(attributes.loading,'eager');assert.equal(attributes.width,800);assert.equal(attributes.height,450);
});

test('private staging, external sources and authenticated URLs never enter the public resizer',()=>{
 const native='/_emdash/api/media/file/migration/a.jpg';
 for(const origin of ['https://dev.sably.co','http://localhost:4321',undefined])assert.equal(cloudflareImageUrl(native,480,origin),undefined);
 for(const src of ['https://other.example/image.jpg','https://dev.sably.co'+native,native+'?token=private','https://user:secret@sably.co'+native,'//sably.co'+native,'/_emdash/api/media/file/logo.svg','/api/private.jpg','/covers/animation.gif'])assert.equal(cloudflareImageUrl(src,480,'https://sably.co'),undefined);
 assert.equal(createCmsImageService('https://dev.sably.co').getSrcSet({src:native,width:800,height:450},{} as any).length,0);
});
test('ordinary public assets remain directly accessible',()=>{
 const url=service.getURL({src:'/covers/oficios.jpg',width:800,height:536},{endpoint:{route:'/_image'},domains:[],remotePatterns:[]} as any,{} as any);
 assert.equal(url,'/covers/oficios.jpg');
});
