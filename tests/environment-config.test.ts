import assert from 'node:assert/strict';
import test from 'node:test';
import { readTarget,validateTarget,targetConfig } from '../scripts/environment-config.mjs';
const dev=readTarget('development');
test('development configuration names only isolated staging resources',()=>{assert.equal(validateTarget('development',dev).siteUrl,'https://dev.sably.co');});
test('target typos never select production or development implicitly',()=>{assert.throws(()=>targetConfig('prod'));assert.throws(()=>targetConfig('staging'));});
test('production rejects development databases, sessions and media',()=>{
 const production={...structuredClone(dev),name:'sably-emdash-production',routes:[],workers_dev:false,preview_urls:false,vars:{SABLY_ENVIRONMENT:'production',EMDASH_SITE_URL:'https://sably.co'}};
 assert.throws(()=>validateTarget('production',production),/share a development database/);
});
test('production resource placeholders fail before any deployment',()=>{
 const production=readTarget('production');
 // Provisioning can replace placeholders later; when present they must block execution.
 if(production.d1_databases.some((d:{database_id:string})=>d.database_id.startsWith('__')))assert.throws(()=>validateTarget('production',production),/Provision/);
 else assert.equal(validateTarget('production',production).worker,'sably-emdash-production');
});
