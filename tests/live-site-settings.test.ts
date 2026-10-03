import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequestSettingsLoader} from '../src/lib/live-site-settings.ts';
test('settings share one read within a request and refresh across requests',async()=>{
 let title='Antes',reads=0;
 const load=createRequestSettingsLoader({async settings(){reads++;return [{name:'site:title',value:JSON.stringify(title)},{name:'site:logo',value:JSON.stringify({mediaId:'native-logo',alt:'Marca'})},{name:'auth:secret',value:'"excluded"'}];},async media(id){return {id,storageKey:'sync-public/logo.svg',mimeType:'image/svg+xml',width:40,height:20};}});
 const request={};const [first,second]=await Promise.all([load(request),load(request)]);assert.equal(reads,1);assert.equal(first,second);assert.equal(first.title,'Antes');assert.equal(first.logo?.url,'/_emdash/api/media/file/sync-public/logo.svg');assert.equal(first.logo?.contentType,'image/svg+xml');assert.equal((first as any)['auth:secret'],undefined);
 title='Después';assert.equal((await load({})).title,'Después');assert.equal(reads,2);
});
