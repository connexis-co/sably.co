import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Keep the original command as an alias of the single guarded deploy path.
const args = process.argv.slice(2);
assert.ok(args.every(arg => arg === '--dry-run'), 'Only --dry-run is supported');
const result = spawnSync(process.execPath, ['scripts/deploy-environment.mjs', 'development', ...args], {
  stdio: 'inherit', env: process.env,
});
process.exit(result.status ?? 1);
