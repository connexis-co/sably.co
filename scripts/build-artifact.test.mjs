import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeGeneratedSecrets, assertSafeArtifact } from './build-artifact.mjs';
test('build artifacts exclude environment files at every generated depth', () => {
 const root = mkdtempSync(join(tmpdir(), 'sably-artifact-'));
 try {
  mkdirSync(join(root, 'server', 'nested'), { recursive: true });
  for (const path of ['server/.dev.vars', 'server/.dev.vars.production', 'server/nested/.env.local']) writeFileSync(join(root, path), 'test fixture');
  writeFileSync(join(root, 'server', 'index.mjs'), 'export default {};');
  assert.throws(() => assertSafeArtifact(root), /local environment file/);
  removeGeneratedSecrets(root); assertSafeArtifact(root);
  assert(existsSync(join(root, 'server', 'index.mjs')));
 } finally { rmSync(root, { recursive: true, force: true }); }
});
