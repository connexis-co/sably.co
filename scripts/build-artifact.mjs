import assert from 'node:assert/strict';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
export function generatedSecretFiles(root = 'dist') {
  const found = [];
  function scan(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (/^(?:\.dev\.vars|\.env)(?:\.|$)/.test(entry.name)) found.push(path);
      else if (entry.isDirectory()) scan(path);
    }
  }
  scan(root); return found;
}
export function removeGeneratedSecrets(root = 'dist') {
  for (const path of generatedSecretFiles(root)) rmSync(path, { force: true, recursive: true });
}
export function assertSafeArtifact(root = 'dist') {
  assert.equal(generatedSecretFiles(root).length, 0, 'Build artifact contains a local environment file; rebuild using build-environment.mjs');
}
