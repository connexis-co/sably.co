import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function sourceIdentity(target, cwd = process.cwd()) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const sha = git(['rev-parse', 'HEAD']);
  const sourceDirty = Boolean(git(['status', '--porcelain', '--untracked-files=normal']));
  assert.match(sha, /^[a-f0-9]{40}$/);
  if (target === 'production') assert.equal(sourceDirty, false, 'Commit or isolate all changes before building a production candidate');
  return { sha, sourceDirty };
}

export function assertProductionIdentity(manifest) {
  assert.equal(manifest.sourceDirty, false, 'Production requires a clean, committed source identity; rebuild this artifact');
}
