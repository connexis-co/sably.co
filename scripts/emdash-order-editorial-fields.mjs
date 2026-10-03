#!/usr/bin/env node
/** Restore the declared editor order after evolving the original pilot collections. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
assert.equal(config.name,'sably-emdash-dev');assert.equal(config.vars.SABLY_ENVIRONMENT,'development');
const database=config.d1_databases.find(x=>x.binding==='DB').database_id;
assert.equal(database,'d9ed655d-1885-415f-a98e-74d6cd0a6263');
const seed=JSON.parse(await readFile('.emdash/migration-content.seed.json','utf8'));
const collections=seed.collections.filter(x=>['courses','course_locales','blog'].includes(x.slug));
const batch=collections.flatMap(c=>c.fields.map((f,index)=>({sql:'UPDATE _emdash_fields SET sort_order = ? WHERE collection_id = (SELECT id FROM _emdash_collections WHERE slug = ?) AND slug = ? AND sort_order <> ?',params:[index,c.slug,f.slug,index]})));
console.log(JSON.stringify({mode:process.argv.includes('--execute')?'execute':'plan',collections:collections.map(c=>c.slug),fields:batch.length}));
if(!process.argv.includes('--execute'))process.exit(0);
assert(process.env.CLOUDFLARE_API_TOKEN);
async function query(batch){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${database}/query`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({batch})});const data=await response.json();assert(response.ok&&data.success&&data.result.every(x=>x.success),'Editorial field order update failed');return data.result;}
const applied=await query(batch);
for(const c of collections){const result=await query([{sql:'SELECT f.slug FROM _emdash_fields f JOIN _emdash_collections c ON c.id = f.collection_id WHERE c.slug = ? ORDER BY f.sort_order',params:[c.slug]}]);assert.deepEqual(result[0].results.map(x=>x.slug),c.fields.map(x=>x.slug));}
const result={verified:true,fields:batch.length,updated:applied.reduce((n,r)=>n+(r.meta?.changes??0),0)};
await writeFile('.emdash/editorial-order-result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));
