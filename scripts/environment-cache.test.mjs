import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readTarget,validateTarget} from './environment-config.mjs';

test('production rejects shared editorial caches and session namespaces',()=>{
 const development=readTarget('development'),production=readTarget('production');
 assert.doesNotThrow(()=>validateTarget('production',production,development));
 const cache=production.kv_namespaces.find(n=>n.binding==='CACHE');
 cache.id=development.kv_namespaces.find(n=>n.binding==='CACHE').id;
 assert.throws(()=>validateTarget('production',production,development),/cache must be isolated/);
 cache.id=production.kv_namespaces.find(n=>n.binding==='SESSION').id;
 assert.throws(()=>validateTarget('production',production,development),/session storage/);
});
