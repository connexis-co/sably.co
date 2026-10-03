import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sourceIdentity, assertProductionIdentity } from './source-identity.mjs';

test('production identifies an exact committed tree and rejects changes or untracked source', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sably-source-identity-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  try {
    git('init', '-q'); git('config', 'user.name', 'Source test'); git('config', 'user.email', 'test@example.invalid');
    writeFileSync(join(cwd, 'source.txt'), 'committed');
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'test: initial source');
    const original = sourceIdentity('production', cwd);
    assert.equal(original.sourceDirty, false); assertProductionIdentity(original);
    writeFileSync(join(cwd, 'source.txt'), 'changed');
    assert.throws(() => sourceIdentity('production', cwd), /Commit or isolate/);
    assert.deepEqual(sourceIdentity('development', cwd), { sha: original.sha, sourceDirty: true });
    git('add', '.');
    assert.throws(() => sourceIdentity('production', cwd), /Commit or isolate/);
    git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'test: changed source');
    writeFileSync(join(cwd, 'new-source.txt'), 'untracked');
    assert.throws(() => sourceIdentity('production', cwd), /Commit or isolate/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('an old artifact or a dirty build cannot be uploaded as a tested production SHA', () => {
  for (const manifest of [{}, { sourceDirty: true }]) assert.throws(() => assertProductionIdentity(manifest), /clean, committed/);
});
