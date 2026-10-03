#!/usr/bin/env node
/** Read-only full integrity check against the development editorial database. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
assert.equal(config.name, 'sably-emdash-dev'); assert.equal(config.vars.SABLY_ENVIRONMENT, 'development');
const database = config.d1_databases.find((item) => item.binding === 'DB').database_id;
assert.equal(database, 'd9ed655d-1885-415f-a98e-74d6cd0a6263');
assert(process.env.CLOUDFLARE_API_TOKEN, 'Set the existing Cloudflare token in the process environment');
const seed = JSON.parse(await readFile('.emdash/migration-content.seed.json', 'utf8'));
const media = JSON.parse(await readFile('.emdash/media-replacements.json', 'utf8'));
const expected = JSON.parse(JSON.stringify(seed, (_key, value) => value?.$media ? { ...media[value.$media.url].value, alt: value.$media.alt ?? media[value.$media.url].value.alt } : value));
const stateOnly = process.argv.includes('--state-only');
const stateFields = ['id', 'slug', 'updated_at', 'version', 'live_revision_id', 'draft_revision_id'];
async function rows(sql, params = []) {
  assert(/^SELECT\b/.test(sql), 'Verification is read-only');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${database}/query`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }),
  });
  const result = await response.json();
  assert(response.ok && result.success && result.result?.[0]?.success, 'Development verification query failed');
  return result.result[0].results;
}
const collections = new Map();
await Promise.all(expected.collections.map(async (collection) => {
  assert.match(collection.slug, /^[a-z][a-z0-9_]*$/);
  const result = []; let last = '';
  while (true) {
    const limit = stateOnly ? 200 : 20;
    const page = await rows(`SELECT ${stateOnly ? stateFields.join(',') : '*'} FROM ec_${collection.slug} WHERE id > ? ORDER BY id LIMIT ${limit}`, [last]); result.push(...page);
    if (page.length < limit) break; last = page.at(-1).id;
  }
  collections.set(collection.slug, new Map(result.map((row) => [row.slug, row])));
}));
const editorialStateHash = createHash('sha256').update(JSON.stringify([...collections].sort(([a], [b]) => a.localeCompare(b)).map(([name, entries]) => [name, [...entries.values()].map((row) => stateFields.map((field) => row[field]))]))).digest('hex');
if (stateOnly) {
  const previous = JSON.parse(await readFile('.emdash/remote-integrity-report.json', 'utf8'));
  assert.equal(editorialStateHash, previous.editorialStateHash, 'Editorial rows changed during the idempotence check');
  console.log(JSON.stringify({ idempotent: true, editorialStateHash }));
  process.exit(0);
}
let fieldsChecked = 0, referencesChecked = 0;
const jsonTypes = new Set(['json', 'portableText', 'repeater', 'blocks', 'multiSelect', 'image']);
for (const collection of expected.collections) {
  const bySlug = collections.get(collection.slug), definitions = new Map(collection.fields.map((field) => [field.slug, field]));
  assert.equal(bySlug.size, expected.content[collection.slug].length, `${collection.slug}: unexpected count or duplicate slugs`);
  for (const entry of expected.content[collection.slug]) {
    const row = bySlug.get(entry.slug); assert(row, `Missing ${collection.slug}/${entry.slug}`);
    assert.equal(row.locale, entry.locale); assert.equal(row.status, entry.status); assert.equal(row.deleted_at, null);
    for (const [key, value] of Object.entries(entry.data)) {
      const definition = definitions.get(key); if (definition.type === 'reference') continue;
      let actual = row[key]; if (jsonTypes.has(definition.type) && typeof actual === 'string') actual = JSON.parse(actual);
      if (definition.type === 'boolean') actual = Boolean(actual);
      assert.deepEqual(actual, value, `Mismatch ${collection.slug}/${entry.slug}.${key}`); fieldsChecked++;
    }
  }
}
const relationRows = await rows('SELECT id,slug FROM _emdash_relations');
const links = await rows('SELECT relation_id,parent_group,child_group,sort_order FROM _emdash_content_references ORDER BY relation_id,parent_group,sort_order');
for (const collection of expected.collections) for (const field of collection.fields.filter((field) => field.type === 'reference')) {
  const relation = relationRows.find((row) => row.slug === field.validation.relation); assert(relation);
  for (const entry of seed.content[collection.slug]) {
    const parent = collections.get(collection.slug).get(entry.slug);
    const actual = links.filter((link) => link.relation_id === relation.id && link.parent_group === parent.translation_group).map((link) => link.child_group);
    const targets = (entry.data[field.slug] ?? []).map((value) => {
      const [name, ...slug] = value.slice(5).split(':'); return collections.get(name).get(slug.join(':')).translation_group;
    });
    assert.deepEqual(actual, targets, `Relation mismatch ${collection.slug}/${entry.slug}.${field.slug}`); referencesChecked += actual.length;
  }
}
assert.equal(links.length, referencesChecked, 'Unexpected extra relation edges');
const readyMedia = await rows("SELECT id,storage_key,content_hash FROM media WHERE status='ready'");
const desiredMedia = new Map(Object.values(media).filter((item) => item.value.provider === 'local').map((item) => [item.value.id, item]));
assert(readyMedia.length >= desiredMedia.size, 'An imported image is missing');
for (const id of desiredMedia.keys()) assert(readyMedia.some((row) => row.id === id), 'An imported image identity is missing');
for (const row of readyMedia) {
  const wanted = desiredMedia.get(row.id); if (!wanted) continue; // Preserve media already owned by this CMS.
  assert.equal(row.storage_key, wanted.value.meta.storageKey); assert.equal(row.content_hash, wanted.sha256);
}
const report = { verified: true, counts: Object.fromEntries([...collections].map(([name, rows]) => [name, rows.size])), fieldsChecked, referencesChecked, localMediaSources: Object.values(media).filter((item) => item.value.provider === 'local').length, importedLibraryImages: desiredMedia.size, preservedOtherLibraryImages: readyMedia.length - desiredMedia.size, unavailableExternalImages: Object.values(media).filter((item) => item.unavailable).length, editorialStateHash, seedSha256: createHash('sha256').update(JSON.stringify(seed)).digest('hex') };
await writeFile('.emdash/remote-integrity-report.json', `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
