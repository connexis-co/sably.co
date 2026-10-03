import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { applyOperationalSchema, parseArgs, planPluginSchema, planSeed, ROOT, splitSQL, validateOperationalTarget } from './apply-operational-schema.mjs';

const plugin = join(ROOT, 'src/plugins/sably-operations');
const read = name => readFileSync(join(plugin, name), 'utf8');
const legacy = db => {
  db.exec('CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY)');
  for (const name of readdirSync(join(ROOT, 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT name FROM d1_migrations WHERE name=?').get(name)) continue;
    db.exec(readFileSync(join(ROOT, 'migrations', name), 'utf8'));
    db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(name);
  }
};
function localRunner(db, calls) {
  return args => {
    calls.push(args.slice());
    assert.equal(args[0], 'd1');
    assert.equal(args[args[1] === 'migrations' ? 3 : 2], 'SABLY_DB');
    assert.ok(args.includes('--remote'));
    if (args[1] === 'migrations') { legacy(db); return ''; }
    if (args.includes('--command')) return JSON.stringify([{ success: true, results: db.prepare(args[args.indexOf('--command') + 1]).all() }]);
    db.exec('BEGIN');
    try { db.exec(readFileSync(args[args.indexOf('--file') + 1], 'utf8')); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    return JSON.stringify([{ success: true, results: [] }]);
  };
}

test('CLI requires explicit target and execute; dry-run does not connect', () => {
  assert.deepEqual(parseArgs(['--target', 'development']), { target: 'development', execute: false });
  assert.deepEqual(parseArgs(['--target', 'production', '--execute']), { target: 'production', execute: true });
  for (const args of [[], ['--target', 'prod'], ['--target', 'production', '--execute', '--dry-run'], ['--target', 'development', '--unknown']]) assert.throws(() => parseArgs(args));
  const plan = applyOperationalSchema({ target: 'development', run() { assert.fail('Offline dry run must not invoke Wrangler'); }, log() {} });
  assert.equal(plan.binding, 'SABLY_DB');
  assert.equal(plan.legacyMigrations.length, 12);
});

test('target validation rejects CMS DB, other operational database and migration paths', () => {
  const development = JSON.parse(readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8'));
  const production = JSON.parse(readFileSync(join(ROOT, 'config/wrangler.production.jsonc'), 'utf8'));
  validateOperationalTarget('production', production, development);
  for (const mutate of [
    cfg => cfg.d1_databases.find(item => item.binding === 'SABLY_DB').database_id = cfg.d1_databases.find(item => item.binding === 'DB').database_id,
    cfg => cfg.d1_databases.find(item => item.binding === 'SABLY_DB').database_name = 'some-other-db',
    cfg => cfg.d1_databases.find(item => item.binding === 'SABLY_DB').migrations_dir = '../migrations-emdash',
  ]) { const bad = structuredClone(production); mutate(bad); assert.throws(() => validateOperationalTarget('production', bad, development)); }
});

test('SQL parser preserves punctuation in public content and rejects unsupported schema writes', () => {
  const statements = splitSQL("-- outside\nINSERT INTO x VALUES ('O''Brien; -- here', '/* quote */'); /* outside */\nSELECT 1;");
  assert.deepEqual(statements, ["INSERT INTO x VALUES ('O''Brien; -- here', '/* quote */');", 'SELECT 1;']);
  assert.throws(() => splitSQL("SELECT 'unfinished"));
  assert.throws(() => planPluginSchema('DELETE FROM promocion;', { tables: ['promocion'], indexes: [], columns: {} }));
  assert.throws(() => planSeed('public-data-seed.sql', 'UPDATE promocion SET activa=1;', 'fresh'));
});

test('empty DB receives complete schema and baseline, then preserves changed settings and moderation', () => {
  const db = new DatabaseSync(':memory:'), calls = [];
  try {
    const options = { target: 'development', execute: true, run: localRunner(db, calls), log() {} };
    applyOperationalSchema(options);
    assert.equal(db.prepare('SELECT mode FROM _sably_operations_migrations WHERE id=?').get('bootstrap-v1').mode, 'fresh');
    assert.equal(db.prepare('SELECT pct FROM promocion WHERE id=?').get('legacy-manual').pct, 50);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sably_public_review').get().n, 139);
    db.exec("UPDATE widget_video SET modo='auto',bucle=1; UPDATE promocion SET pct=25 WHERE id='legacy-manual'; UPDATE sably_public_review SET status='rejected';");
    const writeCount = calls.filter(args => args.includes('--file')).length;
    applyOperationalSchema(options);
    assert.equal(db.prepare('SELECT modo FROM widget_video').get().modo, 'auto');
    assert.equal(db.prepare('SELECT pct FROM promocion WHERE id=?').get('legacy-manual').pct, 25);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sably_public_review WHERE status='rejected'").get().n, 139);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM lead').get().n, 0);
    assert.equal(calls.filter(args => args.includes('--file')).length - writeCount, 1, 'Second run only ensures the ledger exists; no seeds replay');
  } finally { db.close(); }
});

test('manually initialized development is adopted without resetting settings or rejected reviews', () => {
  const db = new DatabaseSync(':memory:'), calls = [];
  try {
    legacy(db);
    for (const name of ['migration.sql', 'calendar-seed.sql', 'public-settings-seed.sql', 'public-data-seed.sql']) db.exec(read(name));
    db.exec("UPDATE widget_video SET modo='auto',bucle=1; UPDATE promocion SET pct=25 WHERE id='legacy-manual'; UPDATE sably_public_review SET status='rejected';");
    applyOperationalSchema({ target: 'development', execute: true, run: localRunner(db, calls), log() {} });
    assert.equal(db.prepare('SELECT mode FROM _sably_operations_migrations WHERE id=?').get('public-settings-seed.sql').mode, 'adopted');
    assert.equal(db.prepare('SELECT modo FROM widget_video').get().modo, 'auto');
    assert.equal(db.prepare('SELECT pct FROM promocion WHERE id=?').get('legacy-manual').pct, 25);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sably_public_review WHERE status='rejected'").get().n, 139);
    const inventory = { tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name), indexes: db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(row => row.name), columns: { promocion: db.prepare('PRAGMA table_info(promocion)').all().map(row => row.name) } };
    assert.deepEqual(planPluginSchema(read('migration.sql'), inventory), []);
  } finally { db.close(); }
});

test('seed drift is rejected instead of silently replaying a changed baseline', () => {
  const first = planSeed('calendar-seed.sql', read('calendar-seed.sql'), 'fresh');
  assert.equal(planSeed('calendar-seed.sql', read('calendar-seed.sql'), 'fresh', first), null);
  assert.throws(() => planSeed('calendar-seed.sql', read('calendar-seed.sql') + '\n-- changed', 'fresh', first), /versioned migration/);
});
