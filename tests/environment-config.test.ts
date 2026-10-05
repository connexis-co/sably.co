import assert from 'node:assert/strict';
import test from 'node:test';
import { readTarget,validateTarget,targetConfig,PRODUCTION_ASSET_BYPASS } from '../scripts/environment-config.mjs';
const dev=readTarget('development');
test('development configuration names only isolated staging resources',()=>{assert.equal(validateTarget('development',dev).siteUrl,'https://dev.sably.co');});
test('target typos never select production or development implicitly',()=>{assert.throws(()=>targetConfig('prod'));assert.throws(()=>targetConfig('staging'));});
test('production rejects development databases, sessions and media',()=>{
 const production={...readTarget('production'),d1_databases:structuredClone(dev.d1_databases)};
 assert.throws(()=>validateTarget('production',production),/share a development database/);
});
test('development cannot skip its gate and production only bypasses reviewed public assets',()=>{
 const unsafeDev=structuredClone(dev);unsafeDev.assets.run_worker_first=false;
 assert.throws(()=>validateTarget('development',unsafeDev),/protect static assets/);
 const unsafeProd=readTarget('production');unsafeProd.assets.run_worker_first=false;
 assert.throws(()=>validateTarget('production',unsafeProd),/Only reviewed public assets/);
 const widened=readTarget('production');widened.assets.run_worker_first=[...widened.assets.run_worker_first,'!/api/*'];
 assert.throws(()=>validateTarget('production',widened),/Only reviewed public assets/);
 // Pages, APIs, media originals and robots/sitemaps always run the Worker.
 for(const path of ['/*','/api/*','/_emdash/*','/robots.txt']) assert.ok(!PRODUCTION_ASSET_BYPASS.includes(path),path);
});
test('production runs unplaced, next to its D1 databases',()=>{
 for(const placement of [{region:'aws:us-east-1'},{mode:'smart'}]){
  const placed=readTarget('production');placed.placement=placement;
  assert.throws(()=>validateTarget('production',placed),/runs unplaced/);
 }
 assert.equal(dev.placement,undefined,'Development keeps default placement');
});
test('production resource placeholders fail before any deployment',()=>{
 const production=readTarget('production');
 // Provisioning can replace placeholders later; when present they must block execution.
 if(production.d1_databases.some((d:{database_id:string})=>d.database_id.startsWith('__')))assert.throws(()=>validateTarget('production',production),/Provision/);
 else assert.equal(validateTarget('production',production).worker,'sably-emdash-production');
});
