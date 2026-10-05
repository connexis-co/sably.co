import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const TARGETS = {
 development: { configPath:'./wrangler.jsonc',siteUrl:'https://dev.sably.co',worker:'sably-emdash-dev' },
 production: { configPath:'./config/wrangler.production.jsonc',siteUrl:'https://sably.co',worker:'sably-emdash-production' },
};
export function targetConfig(target=process.env.SABLY_TARGET??'development') {
 assert.ok(Object.hasOwn(TARGETS,target),'SABLY_TARGET must be development or production');
 return {target,...TARGETS[target]};
}
/** Public files Workers Static Assets serves without the Worker: compiled bundles and brand/media files. */
export const PRODUCTION_ASSET_BYPASS=['/_astro/*','/brand/*','/covers/*','/creadores/*','/heroes/*','/certificado-sably.jpg','/favicon.ico','/favicon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/site.webmanifest'];
export function readTarget(target) {return JSON.parse(readFileSync(targetConfig(target).configPath,'utf8'));}
export function fingerprint(config) {return createHash('sha256').update(JSON.stringify(config)).digest('hex');}
export function validateTarget(target,config,development=readTarget('development')) {
 const spec=targetConfig(target);assert.equal(config.name,spec.worker,'Wrong Worker target');
 assert.equal(config.account_id,'6e36c2fb07c21f30ed3c0d6e824884bc','Wrong Cloudflare account');
 assert.equal(config.vars?.SABLY_ENVIRONMENT,target,'Runtime environment mismatch');
 assert.equal(config.vars?.EMDASH_SITE_URL,spec.siteUrl,'Site URL mismatch');
 if(target==='development') {
  assert.equal(config.assets?.run_worker_first,true,'Worker must protect static assets in development');
  assert.equal(config.cache?.enabled,false,'Development must not cache protected responses');
 } else {
  assert.deepEqual(config.assets?.run_worker_first,['/*',...PRODUCTION_ASSET_BYPASS.map(path=>`!${path}`)],'Only reviewed public assets may bypass the production Worker');
  assert.deepEqual(config.placement,{region:'aws:us-east-1'},'Production renders next to its ENAM D1 databases');
  assert.equal(config.cache?.enabled,true,'Production requires the reviewed native cache policy');
  assert.equal(config.version_metadata?.binding,'CF_VERSION_METADATA','Cache must carry the deployment version');
 }
 for(const binding of ['DB','SABLY_DB']) {
  const database=config.d1_databases?.find(d=>d.binding===binding);
  assert.match(database?.database_id??'',/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,'Provision the target D1 databases before building/deploying');
  if(target==='production') assert.ok(!development.d1_databases.some(d=>d.database_id===database.database_id),'Production must not share a development database');
  else assert.equal(database.database_id, {DB:'d9ed655d-1885-415f-a98e-74d6cd0a6263',SABLY_DB:'0dcde91f-9895-44e6-b685-0f6d857f3b70'}[binding], 'Development database identity changed; review its isolation before deploying');
 }
 const media=config.r2_buckets?.find(b=>b.binding==='MEDIA');assert.ok(media?.bucket_name,'MEDIA bucket is required');
 const session=config.kv_namespaces?.find(b=>b.binding==='SESSION');assert.match(session?.id??'',/^[a-f0-9]{32}$/,'Provision the target SESSION namespace');
 const cache=config.kv_namespaces?.find(b=>b.binding==='CACHE');assert.match(cache?.id??'',/^[a-f0-9]{32}$/,'Provision the target CACHE namespace');
 assert.notEqual(cache.id,session.id,'Content cache must not share session storage');
 if(target==='development')assert.deepEqual(config.routes,[{pattern:'dev.sably.co',custom_domain:true}]);
 else {
  assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
  assert.notEqual(media.bucket_name,development.r2_buckets.find(b=>b.binding==='MEDIA')?.bucket_name,'Production media must be isolated');
  assert.notEqual(session.id,development.kv_namespaces.find(b=>b.binding==='SESSION')?.id,'Sessions must be isolated');
  assert.ok(!development.kv_namespaces.some(b=>b.id===cache.id),'Production cache must be isolated from development');
  assert.ok((config.routes??[]).every(r=>r.custom_domain===true&&['sably.co','www.sably.co'].includes(r.pattern)),'Unexpected production route');
 }
 return spec;
}
