import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('retired production CLI rejects every mode before reading an artifact or calling Wrangler', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sably-retired-production-'));
  try {
    const script = fileURLToPath(new URL('./deploy-environment.mjs', import.meta.url));
    for (const flags of [[], ['--dry-run'], ['--publish']]) {
      const result = spawnSync(process.execPath, [script, 'production', ...flags], {
        cwd, encoding: 'utf8', env: { ...process.env, SABLY_PRODUCTION_ACTIVATED: 'true' },
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Cloudflare production deployment is retired/);
      assert.doesNotMatch(result.stderr, /ENOENT|wrangler\.js/);
    }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
