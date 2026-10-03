#!/usr/bin/env node
/** Explicit development-only importer. Defaults to a local plan; --execute sends audited batches. */
import assert from 'node:assert/strict';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSeed } from 'emdash/seed';
import { allowedMediaSource, canonicalJson, isPilotEntry, LEGACY_AUTHOR_IMAGE, MIGRATION_COLLECTIONS, readLimited, sha256, snapshotHash } from '../src/lib/emdash-migration-guard.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const phase = option('--only', 'all');
const origin = new URL(option('--url', 'https://dev.sably.co'));
assert(['dev.sably.co', 'localhost', '127.0.0.1'].includes(origin.hostname), 'Importer only targets the development site');
assert(origin.hostname !== 'dev.sably.co' || origin.protocol === 'https:', 'Development requests require HTTPS');
assert(['all', 'schema', 'media', 'content', 'status'].includes(phase), 'Unknown import phase');
const seedPath = resolve(root, option('--seed', '.emdash/migration-content.seed.json'));
const manifestPath = resolve(root, option('--manifest', '.emdash/media-manifest.json'));
const snapshotPath = resolve(root, option('--snapshot', '.emdash/existing-content.json'));
const outputDirectory = join(root, '.emdash');
const endpoint = new URL('/internal/migrate-emdash', origin);
const logPath = join(outputDirectory, 'import-log.jsonl');
const replacementPath = join(outputDirectory, 'media-replacements.json');
const encoder = new TextEncoder();

async function record(event) {
  await mkdir(outputDirectory, { recursive: true });
  await appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

async function request(method, body, extraHeaders = {}) {
  assert(process.env.SABLY_DEV_PASSWORD, 'Set SABLY_DEV_PASSWORD in the process environment');
  assert((process.env.SABLY_MIGRATION_TOKEN?.length ?? 0) >= 32, 'Set SABLY_MIGRATION_TOKEN in the process environment');
  const response = await fetch(endpoint, {
    method, redirect: 'error', body,
    headers: {
      'X-Sably-Preview-Token': process.env.SABLY_DEV_PASSWORD,
      'X-Sably-Migration-Token': process.env.SABLY_MIGRATION_TOKEN,
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(90_000),
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`Import endpoint returned HTTP ${response.status}, not JSON`); }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error ?? 'Import failed'}`);
  return result;
}

async function sendBatch(payload) {
  const result = await request('POST', JSON.stringify(payload), { 'Content-Type': 'application/json' });
  await record({ kind: payload.kind, batchId: payload.batchId, result });
  return result;
}

async function importMedia(manifest) {
  let replacements = {};
  try { replacements = JSON.parse(await readFile(replacementPath, 'utf8')); } catch {}
  for (let index = 0; index < manifest.assets.length; index++) {
    const asset = manifest.assets[index];
    assert(allowedMediaSource(asset.url), `Media URL outside allowed migration sources: ${asset.filename}`);
    const previous = replacements[asset.url];
    if (asset.localPath && previous?.value?.provider === 'local' && previous.sha256 === asset.sha256) continue;
    let bytes;
    let mimeType = asset.mimeType;
    if (asset.localPath) {
      const localPath = resolve(root, asset.localPath);
      assert(localPath.startsWith(`${resolve(root, 'public')}${sep}`), 'Media path must be inside public');
      bytes = new Uint8Array(await readFile(localPath));
      assert.equal(await sha256(bytes), asset.sha256, `Local image changed: ${asset.localPath}`);
    } else {
      const remote = await fetch(asset.url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
      if (!remote.ok && asset.url === LEGACY_AUTHOR_IMAGE && remote.status === 403) {
        // The one historical third-party avatar is already unavailable at its source.
        // Keep its public external reference instead of replacing it with invented media.
        replacements[asset.url] = { unavailable: true, sourceStatus: 403, url: asset.url, value: {
          provider: 'external', id: `legacy-${(await sha256(asset.url)).slice(0, 26)}`, src: asset.url, alt: asset.alt ?? '', filename: asset.filename,
        } };
        await record({ kind: 'media-unavailable', source: asset.url, sourceStatus: 403 });
        await writeFile(replacementPath, `${JSON.stringify(replacements, null, 2)}\n`);
        continue;
      }
      assert(remote.ok, `Source image returned HTTP ${remote.status}: ${asset.filename}`);
      mimeType = remote.headers.get('Content-Type')?.split(';')[0];
      assert(Number(remote.headers.get('Content-Length') ?? 0) <= 2_000_000, 'External image is too large');
      bytes = await readLimited(remote, 2_000_000);
    }
    assert(bytes.length <= 2_000_000, 'Image exceeds migration limit');
    const checksum = await sha256(bytes);
    const metadata = { url: asset.url, filename: asset.filename, alt: asset.alt ?? '', mimeType, sha256: checksum };
    const result = await request('POST', bytes, {
      'Content-Type': 'application/octet-stream',
      'X-Sably-Migration-Meta': Buffer.from(JSON.stringify(metadata)).toString('base64'),
    });
    replacements[asset.url] = { sha256: checksum, value: result.value, url: result.url };
    await record({ kind: 'media', source: asset.url, sha256: checksum, created: result.created, skipped: result.skipped, id: result.value.id });
    // Each completed upload has a recovery record, even if a later upload fails.
    await writeFile(replacementPath, `${JSON.stringify(replacements, null, 2)}\n`);
    if ((index + 1) % 25 === 0 || index + 1 === manifest.assets.length) console.log(`Media ${index + 1}/${manifest.assets.length}`);
  }
  return replacements;
}

function replaceMedia(seed, replacements) {
  return JSON.parse(JSON.stringify(seed, (_key, value) => {
    if (!value?.$media) return value;
    const found = replacements[value.$media.url];
    assert(found?.value?.provider === 'local' || (value.$media.url === LEGACY_AUTHOR_IMAGE && found?.unavailable && found.value?.provider === 'external'), `Missing library image: ${value.$media.filename}`);
    return { ...found.value, alt: value.$media.alt ?? found.value.alt };
  }));
}

async function contentExpectations() {
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  assert(Array.isArray(snapshot) && snapshot.length === 3, 'Reviewed snapshot must contain the three pilot SELECT results');
  const result = {};
  for (const [index, collection] of ['courses', 'course_locales', 'blog'].entries()) {
    result[collection] = {};
    for (const row of snapshot[index].results) {
      assert(isPilotEntry(collection, row.slug), 'Snapshot contains an unexpected entry');
      const fields = Object.keys(row).sort();
      result[collection][row.slug] = { fields, hash: await snapshotHash(row, fields) };
    }
  }
  return result;
}

async function main() {
  if (phase === 'status') {
    if (!execute) { console.log('Plan: read development import counts. Add --execute to request.'); return; }
    console.log(JSON.stringify(await request('GET'), null, 2));
    return;
  }
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));
  const validation = validateSeed(seed);
  assert(validation.valid, validation.errors.join('\n'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const seedId = (await sha256(canonicalJson(seed))).slice(0, 24);
  const counts = Object.fromEntries(Object.entries(seed.content ?? {}).map(([collection, entries]) => [collection, entries.length]));
  console.log(JSON.stringify({ action: execute ? 'execute' : 'plan', origin: origin.origin, phase, counts, media: manifest.assets.length, seedId }, null, 2));
  if (!execute) return;
  await mkdir(outputDirectory, { recursive: true });
  if (phase === 'all' || phase === 'schema') {
    const { content: _content, ...schema } = seed;
    const result = await sendBatch({ kind: 'schema', batchId: `${seedId}:schema`, seed: schema });
    console.log('Schema imported; existing menus and widget areas preserved.');
    await record({ kind: 'schema-summary', result });
  }
  let replacements;
  if (phase === 'all' || phase === 'media') replacements = await importMedia(manifest);
  if (phase === 'all' || phase === 'content') {
    replacements ??= JSON.parse(await readFile(replacementPath, 'utf8'));
    const resolvedSeed = replaceMedia(seed, replacements);
    const expectations = await contentExpectations();
    const totals = { created: 0, updated: 0, skipped: 0 };
    // Dependency order is part of the import contract. The server resolves refs to real IDs between calls.
    for (const collection of MIGRATION_COLLECTIONS) {
      const entries = resolvedSeed.content[collection] ?? [];
      const existing = entries.filter((entry) => isPilotEntry(collection, entry.slug));
      const fresh = entries.filter((entry) => !isPilotEntry(collection, entry.slug));
      for (const [mode, selected] of [['skip', fresh], ['preserve-pilot', existing]]) {
        for (let index = 0; index < selected.length; index += 10) {
          const batch = selected.slice(index, index + 10);
          const payload = {
            kind: 'content', batchId: `${seedId}:${collection}:${mode}:${index}`, collection, mode, entries: batch,
            ...(mode === 'preserve-pilot' ? { expected: expectations[collection] } : {}),
          };
          assert(encoder.encode(JSON.stringify(payload)).length < 1_500_000, 'Content batch exceeds server limit');
          const result = await sendBatch(payload);
          if (result.replayed) totals.skipped += batch.length;
          else for (const key of Object.keys(totals)) totals[key] += result[key] ?? 0;
        }
      }
      console.log(`Content ${collection}: ${entries.length} processed`);
    }
    console.log(JSON.stringify({ completed: totals, verified: await request('GET') }, null, 2));
  }
}

main().catch(async (error) => {
  await record({ kind: 'failure', message: error.message });
  console.error(error.message);
  process.exitCode = 1;
});
