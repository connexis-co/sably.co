import assert from 'node:assert/strict';
import {test} from 'node:test';
import service from '../src/lib/cms-image-service';

test('native R2 assets with nested migration keys bypass the static asset transform endpoint',()=>{
 for(const src of ['/_emdash/api/media/file/migration/a.jpg','https://sably.co/_emdash/api/media/file/migration/a.jpg']){
  assert.equal(service.getURL({src,width:800,height:536},{} as any,{} as any),src);
 }
});
test('ordinary public assets remain directly accessible',()=>{
 const url=service.getURL({src:'/covers/oficios.jpg',width:800,height:536},{endpoint:{route:'/_image'},domains:[],remotePatterns:[]} as any,{} as any);
 assert.equal(url,'/covers/oficios.jpg');
});
