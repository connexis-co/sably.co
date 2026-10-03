import assert from 'node:assert/strict';
import test from 'node:test';
import { gateEnvironment,protectEnvironmentResponse } from '../src/lib/runtime-environment.ts';
test('development stays gated even under a production hostname',async()=>{
 const result=await gateEnvironment(new Request('https://sably.co/'),{SABLY_ENVIRONMENT:'development',SABLY_DEV_PASSWORD:'test-secret'});
 assert.equal(result?.status,401);assert.match(result!.headers.get('X-Robots-Tag')!,/noindex/);
});
test('production responses keep editorial headers and have no staging gate',async()=>{
 assert.equal(await gateEnvironment(new Request('https://sably.co/'),{SABLY_ENVIRONMENT:'production'}),null);
 const response=protectEnvironmentResponse(new Response('ok',{headers:{'Cache-Control':'public, max-age=60'}}),{SABLY_ENVIRONMENT:'production'});
 assert.equal(response.headers.get('WWW-Authenticate'),null);assert.equal(response.headers.get('X-Robots-Tag'),null);assert.equal(response.headers.get('Cache-Control'),'public, max-age=60');
});
test('missing or misspelled environment fails closed',async()=>{
 for(const value of [undefined,'prod','staging'])assert.equal((await gateEnvironment(new Request('https://dev.sably.co/'),{SABLY_ENVIRONMENT:value}))?.status,503);
});
