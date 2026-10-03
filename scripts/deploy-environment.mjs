import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { targetConfig, readTarget, validateTarget, fingerprint } from './environment-config.mjs';
import { assertSafeArtifact } from './build-artifact.mjs';
import { assertProductionIdentity } from './source-identity.mjs';
assertSafeArtifact();
const args=process.argv.slice(2);const target=args.shift();const spec=targetConfig(target);
assert.ok(args.every(a=>a==='--dry-run'||a==='--publish'),'Supported flags: --dry-run, --publish');
const dryRun=args.includes('--dry-run'),publish=args.includes('--publish');
const source=readTarget(spec.target);validateTarget(spec.target,source);
const built=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));validateTarget(spec.target,built);
const manifest=JSON.parse(readFileSync('dist/sably-build.json','utf8'));
if(spec.target==='production')assertProductionIdentity(manifest);
assert.equal(manifest.target,spec.target);assert.equal(manifest.worker,spec.worker);assert.equal(manifest.configSha256,fingerprint(source),'Rebuild after changing target configuration');
assert.match(manifest.sha,/^[a-f0-9]{40}$/);if(process.env.SABLY_DEPLOY_SHA)assert.equal(manifest.sha,process.env.SABLY_DEPLOY_SHA);
for(const binding of ['DB','SABLY_DB'])assert.equal(built.d1_databases.find(d=>d.binding===binding)?.database_id,source.d1_databases.find(d=>d.binding===binding)?.database_id,'Built database differs from reviewed target');
assert.equal(built.r2_buckets.find(b=>b.binding==='MEDIA')?.bucket_name,source.r2_buckets.find(b=>b.binding==='MEDIA')?.bucket_name);
if(publish){assert.equal(spec.target,'production');assert.equal(process.env.SABLY_PRODUCTION_ACTIVATED,'true','First production cutover must be approved separately');assert.equal(source.vars.SABLY_CMS_READY,'true','Production CMS must be ready');assert.equal(source.vars.SABLY_PRODUCTION_ACTIVATED,'true','Production runtime integrations must be activated');assert.ok(source.routes?.some(r=>r.pattern==='sably.co'),'Production domain must be attached after its approved cutover');}
const command=spec.target==='production'?['versions','upload','--tag',manifest.sha,'--message',`Sably ${manifest.sha}`]:['deploy'];
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...command,'--config','dist/server/wrangler.json',...(dryRun?['--dry-run']:[])],{encoding:'utf8',env:process.env});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');if(result.status!==0)process.exit(result.status??1);
if(spec.target==='production'&&!dryRun){
 const versionId=(result.stdout??'').match(/Worker Version ID:\s*([a-f0-9-]{36})/i)?.[1];assert.ok(versionId,'Upload completed but version identity could not be confirmed; do not activate');
 const record={...manifest,versionId,activated:false,createdAt:new Date().toISOString()};
 if(publish){const deployed=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','versions','deploy',`${versionId}@100%`,'--yes','--message',`Promote tested commit ${manifest.sha}`,'--config','dist/server/wrangler.json'],{stdio:'inherit',env:process.env});if(deployed.status!==0)process.exit(deployed.status??1);record.activated=true;}
 writeFileSync('dist/sably-release.json',JSON.stringify(record,null,2)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Worker: ${spec.worker}\n\nSHA: ${manifest.sha}\n\nVersion: ${versionId}\n\nTraffic activated: ${record.activated}\n`);
}
