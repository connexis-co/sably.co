/** Full import/read-back test against a disposable, local SQLite database. No network or remote mutations. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './emdash-content.mjs';
import { readMigrationSource } from './emdash-editorial.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'node_modules/emdash/dist/cli/index.mjs');

test('imports all source fields and raw bodies without loss, and skip is idempotent', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'sably-emdash-content-'));
  let db;
  try {
    const { seed, counts } = await buildSeed('full');
    const { seed: secondSeed } = await buildSeed('full');
    assert.deepEqual(seed, secondSeed, 'Generation must be deterministic');
    const seedPath = join(temporary, 'seed.json');
    const databasePath = join(temporary, 'validation.db');
    // Exercise native media fields without network: same external-provider shape
    // emitted by applySeed({skipMediaDownload:true}), with stable test identities.
    const localSeed = JSON.parse(JSON.stringify(seed, (_key, value) => value?.$media ? {
      provider: 'external', id: createHash('sha256').update(value.$media.url).digest('hex').slice(0, 26),
      src: value.$media.url, alt: value.$media.alt, filename: value.$media.filename,
    } : value));
    await writeFile(seedPath, JSON.stringify(localSeed));

    const apply = (mode) => execFileSync(process.execPath, [
      cli, 'seed', seedPath, '--database', databasePath, '--on-conflict', mode,
    ], { cwd: temporary, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    apply('error');
    apply('skip');
    db = new DatabaseSync(databasePath, { readOnly: true });

    let checked = 0;
    const storedByCollection = new Map();
    for (const collection of seed.collections) {
      assert.match(collection.slug, /^[a-z][a-z0-9_]*$/);
      const rows = db.prepare(`SELECT * FROM ec_${collection.slug}`).all();
      assert.equal(rows.length, counts[collection.slug], `${collection.slug}: no missing or duplicated entries`);
      const bySlug = new Map(rows.map((row) => [row.slug, row]));
      storedByCollection.set(collection.slug, bySlug);
      assert.equal(bySlug.size, rows.length, `${collection.slug}: duplicated slugs`);
      const fields = new Map(collection.fields.map((field) => [field.slug, field.type]));
      for (const entry of localSeed.content[collection.slug]) {
        const row = bySlug.get(entry.slug);
        assert(row, `${collection.slug}/${entry.slug}: missing row`);
        assert.equal(row.status, 'published');
        assert.equal(row.locale, 'es');
        for (const [key, expected] of Object.entries(entry.data)) {
          if (fields.get(key) === 'reference') continue; // Relations are checked below, not columns.
          let actual = row[key];
          if (['json', 'portableText', 'repeater', 'blocks', 'multiSelect', 'image'].includes(fields.get(key))) actual = JSON.parse(actual);
          if (fields.get(key) === 'boolean') actual = Boolean(actual);
          assert.deepEqual(actual, expected, `${collection.slug}/${entry.slug}.${key}: changed during import`);
        }
        const original = await readMigrationSource(root, row.source_path);
        assert.equal(createHash('sha256').update(original).digest('hex'), row.source_sha256);
        if (row.source_body !== undefined) {
          const delimiter = original.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
          assert(delimiter);
          assert.equal(original.slice(delimiter[0].length), row.source_body, `${entry.slug}: raw MDX body changed`);
        }
        checked++;
      }
    }
    assert.equal(checked, Object.values(counts).reduce((sum, count) => sum + count, 0));
    let expectedReferences = 0;
    for (const collection of localSeed.collections) {
      for (const definition of collection.fields.filter((field) => field.type === 'reference')) {
        const relation = localSeed.relations.find((relation) => relation.slug === definition.validation.relation);
        const relationRow = db.prepare('SELECT id FROM _emdash_relations WHERE slug = ?').get(relation.slug);
        assert(relationRow, `Missing relation ${relation.slug}`);
        for (const entry of localSeed.content[collection.slug]) {
          const parent = storedByCollection.get(collection.slug).get(entry.slug);
          const links = db.prepare('SELECT child_group FROM _emdash_content_references WHERE relation_id = ? AND parent_group = ? ORDER BY sort_order').all(relationRow.id, parent.translation_group);
          const references = entry.data[definition.slug] ?? [];
          const expected = references.map((reference) => {
            const [targetCollection, ...slugParts] = reference.slice(5).split(':');
            assert.equal(targetCollection, relation.childCollection);
            return storedByCollection.get(targetCollection).get(slugParts.join(':')).translation_group;
          });
          assert.deepEqual(links.map((row) => row.child_group), expected, `${collection.slug}/${entry.slug}: wrong relation ${definition.slug}`);
          expectedReferences += expected.length;
        }
      }
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM _emdash_content_references').get().count, expectedReferences);
  } finally {
    db?.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

test('preserves current CMS edits and derives new editorial fields from them', async () => {
  const snapshot = { content: {
    courses: [{ slug: 'curso-de-barberia', locale: 'es', status: 'draft', data: {
      title: 'Título editado en el CMS', source_body: 'Texto **editado** en el CMS.',
      modules: [{ title: 'Módulo editado', lessons: ['Uno', 'Dos'] }],
    } }],
    course_locales: [{ slug: 'curso-de-barberia--co', locale: 'es', status: 'published', data: {
      descripcion: 'Descripción regional editada.',
    } }],
  } };
  const { seed, merge } = await buildSeed('full', snapshot);
  assert.equal(merge.entries, 2);
  const course = seed.content.courses.find((entry) => entry.slug === 'curso-de-barberia');
  const variant = seed.content.course_locales.find((entry) => entry.slug === 'curso-de-barberia--co');
  assert.equal(course.status, 'draft');
  assert.equal(course.data.title, 'Título editado en el CMS');
  assert.deepEqual(course.data.curriculum, [{ title: 'Módulo editado', lessons_text: 'Uno\nDos' }]);
  assert.match(course.data.body[0].children.map((span) => span.text).join(''), /editado/);
  assert.equal(variant.data.body[0].children[0].text, 'Descripción regional editada.');
});
