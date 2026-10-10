import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { targetConfig } from './environment-config.mjs';
import { removeGeneratedSecrets, assertSafeArtifact } from './build-artifact.mjs';

const target = targetConfig(process.env.SABLY_TARGET || 'production');
let sourceRevision = process.env.SOURCE_REVISION || 'unversioned';
let sourceDirty = null;
try {
  sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
} catch { /* Image builds receive their source identity through SOURCE_REVISION. */ }
const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, SABLY_RUNTIME: 'node', SABLY_TARGET: target.target, EMDASH_SITE_URL: target.siteUrl, PUBLIC_SITE_URL: target.siteUrl,
    PUBLIC_CDN_URL: process.env.PUBLIC_CDN_URL || 'https://cdn.sably.co',
    PUBLIC_LEADS_ENDPOINT: process.env.PUBLIC_LEADS_ENDPOINT || '/api/v1/leads' },
});
if (result.status !== 0) process.exit(result.status ?? 1);
removeGeneratedSecrets();
assertSafeArtifact();
writeFileSync('dist/sably-build.json', `${JSON.stringify({ runtime: 'node', target: target.target, siteUrl: target.siteUrl, sourceRevision, sourceDirty }, null, 2)}\n`);
