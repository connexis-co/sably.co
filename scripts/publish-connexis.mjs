import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const args = new Set(process.argv.slice(2));
assert([...args].every(arg => ['--publish', '--candidate'].includes(arg)), 'Usage: node scripts/publish-connexis.mjs [--publish] [--candidate]');
const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(git('status', '--porcelain'), '', 'Commit and verify all changes before publishing an image.');
const tag = args.has('--candidate') ? 'candidate' : 'production';
if (tag === 'production') execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
const image = '127.0.0.1:5051/sably-emdash';
const directory = `/opt/stacks/sably-emdash/releases/${sha}`;
console.log(JSON.stringify({ host: 'connexis-prod', sha, image: `${image}:${tag}`, directory, restartsApplication: false }, null, 2));
if (!args.has('--publish')) {
  console.log('Plan only. Add --publish to build and publish; then use Update in Dockge.');
  process.exit(0);
}
// Only Git-tracked files at this exact commit are sent. Local credentials,
// databases, uploaded media and .env files never enter the build context.
const commands = [
  'set -eu',
  'test -f /opt/stacks/sably-registry/compose.yaml',
  `mkdir -p ${directory}`,
  `tar -xzf - -C ${directory}`,
  `docker build --build-arg SOURCE_REVISION=${sha} -f ${directory}/deployment/Dockerfile -t ${image}:${sha} ${directory}`,
  `docker push ${image}:${sha}`,
  `docker tag ${image}:${sha} ${image}:${tag}`,
  `docker push ${image}:${tag}`,
];
const remote = spawn('ssh', ['connexis-prod', commands.join('\n')], { stdio: ['pipe', 'inherit', 'inherit'] });
const archive = spawn('git', ['archive', '--format=tar.gz', sha], { stdio: ['ignore', 'pipe', 'inherit'] });
const wait = child => new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Process failed (${code})`)));
});
await Promise.all([pipeline(archive.stdout, remote.stdin), wait(archive), wait(remote)]);
console.log(`Published ${image}:${tag} from ${sha}. Use Update on the sably-emdash stack in Dockge.`);
