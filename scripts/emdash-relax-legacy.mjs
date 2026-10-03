#!/usr/bin/env node
/** One-time, reviewed development-only relaxation of archived pilot columns. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const names = ['courses', 'course_locales', 'blog'];
const schema = JSON.parse(await readFile('.emdash/editorial-table-schema.json', 'utf8'))[0].results;
const snapshot = JSON.parse(await readFile('.emdash/existing-content.json', 'utf8'));
const seed = JSON.parse(await readFile('.emdash/migration-content.seed.json', 'utf8'));
const q = (name) => { assert.match(name, /^[a-zA-Z_][a-zA-Z0-9_]*$/); return `"${name}"`; };
const plan = [], summary = {};
const add = (sql, params = []) => plan.push({ sql: sql.trimEnd().replace(/;$/, '') + ';', params });
add('CREATE TABLE _sably_nullable_guard (ok INTEGER CHECK(ok = 1))');
for (const [index, collection] of names.entries()) {
  const table = `ec_${collection}`, replacement = `${table}_nullable_migration`;
  const original = schema.find((item) => item.type === 'table' && item.name === table);
  assert(original, 'Missing reviewed editorial schema');
  let updated = original.sql.replace(`CREATE TABLE ${q(table)}`, `CREATE TABLE ${q(replacement)}`);
  const fields = [];
  for (const field of seed.collections.find((item) => item.slug === collection).fields) {
    if (field.required) continue;
    const expression = new RegExp(`("${field.slug}" [^,]*?) not null`, 'i');
    if (expression.test(updated)) { updated = updated.replace(expression, '$1'); fields.push(field.slug); }
  }
  assert(fields.every((field) => ['modules', 'learnings', 'audience', 'faqs', 'keywords', 'descripcion', 'beneficios', 'para_quien', 'requisitos', 'generation_metadata', 'source_metadata', 'source_path', 'source_sha256'].includes(field)), 'Only reviewed archived fields may be relaxed');
  assert(fields.length, 'Reviewed pilot columns are already nullable or the schema differs');
  const rows = snapshot[index].results;
  summary[collection] = { rows: rows.length, relaxed: fields, indexes: schema.filter((item) => item.tbl_name === table && item.type === 'index' && item.sql).length, triggers: schema.filter((item) => item.tbl_name === table && item.type === 'trigger').length };
  add(`INSERT INTO _sably_nullable_guard SELECT COUNT(*) = ? FROM ${q(table)}`, [rows.length]);
  add('INSERT INTO _sably_nullable_guard SELECT COUNT(*) FROM sqlite_master WHERE type = ? AND name = ? AND sql = ?', ['table', table, original.sql]);
  for (const row of rows) {
    const keys = Object.keys(row); assert(keys.length <= 100);
    add(`INSERT INTO _sably_nullable_guard SELECT COUNT(*) FROM ${q(table)} WHERE ${keys.map((key) => `${q(key)} IS ?`).join(' AND ')}`, keys.map((key) => row[key]));
  }
  add(updated);
  add(`INSERT INTO ${q(replacement)} SELECT * FROM ${q(table)}`);
  add(`INSERT INTO _sably_nullable_guard SELECT COUNT(*) = 0 FROM (SELECT * FROM ${q(table)} EXCEPT SELECT * FROM ${q(replacement)})`);
  add(`INSERT INTO _sably_nullable_guard SELECT COUNT(*) = 0 FROM (SELECT * FROM ${q(replacement)} EXCEPT SELECT * FROM ${q(table)})`);
  add(`DROP TABLE ${q(table)}`);
  add(`ALTER TABLE ${q(replacement)} RENAME TO ${q(table)}`);
  for (const item of schema.filter((item) => item.tbl_name === table && item.sql && ['index', 'trigger'].includes(item.type))) add(item.sql);
  add(`UPDATE _emdash_fields SET required = 0 WHERE collection_id = (SELECT id FROM _emdash_collections WHERE slug = ?) AND slug IN (${fields.map(() => '?').join(',')})`, [collection, ...fields]);
}
add('DROP TABLE _sably_nullable_guard');
const digest = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
await writeFile('.emdash/relax-legacy-plan.json', `${JSON.stringify({ digest, summary, batch: plan }, null, 2)}\n`, { mode: 0o600 });

// Test the exact batch against the reviewed table definitions and content, without auth data.
const local = new DatabaseSync(':memory:');
local.exec('CREATE TABLE revisions(id TEXT PRIMARY KEY); CREATE TABLE _emdash_collections(id TEXT PRIMARY KEY,slug TEXT); CREATE TABLE _emdash_fields(collection_id TEXT,slug TEXT,required INTEGER)');
local.exec('CREATE TABLE _emdash_media_usage_index_status(adapter_id TEXT,scope_type TEXT,scope_key TEXT,collection_id TEXT,capture_state TEXT,change_epoch INTEGER,status TEXT,completed_at TEXT,updated_at TEXT); CREATE TABLE _emdash_media_usage_work(collection_id TEXT,collection_slug TEXT,content_id TEXT,change_epoch INTEGER,work_version INTEGER,state TEXT,attempt_count INTEGER,next_attempt_at TEXT,lease_token TEXT,lease_expires_at TEXT,last_attempted_at TEXT,last_error_code TEXT,created_at TEXT,updated_at TEXT,UNIQUE(collection_id,content_id))');
for (const [index, collection] of names.entries()) {
  local.exec(schema.find((item) => item.type === 'table' && item.name === `ec_${collection}`).sql);
  for (const row of snapshot[index].results) {
    for (const revision of [row.live_revision_id, row.draft_revision_id].filter(Boolean)) local.prepare('INSERT OR IGNORE INTO revisions(id) VALUES(?)').run(revision);
    const keys = Object.keys(row);
    local.prepare(`INSERT INTO ec_${collection} (${keys.map(q).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((key) => row[key]));
  }
  local.prepare('INSERT INTO _emdash_collections VALUES (?,?)').run(collection, collection);
  for (const field of summary[collection].relaxed) local.prepare('INSERT INTO _emdash_fields VALUES (?,?,1)').run(collection, field);
  for (const item of schema.filter((item) => item.tbl_name === `ec_${collection}` && item.sql && ['index', 'trigger'].includes(item.type))) local.exec(item.sql);
}
const before = names.map((name) => local.prepare(`SELECT * FROM ec_${name} ORDER BY id`).all());
local.exec('BEGIN');
try { for (const step of plan) local.prepare(step.sql).run(...step.params); local.exec('COMMIT'); }
catch (error) { local.exec('ROLLBACK'); throw error; }
for (const [index, collection] of names.entries()) {
  assert.deepEqual(local.prepare(`SELECT * FROM ec_${collection} ORDER BY id`).all(), before[index]);
  const columns = local.prepare(`PRAGMA table_info(ec_${collection})`).all();
  for (const name of summary[collection].relaxed) assert.equal(columns.find((column) => column.name === name).notnull, 0);
  const recreated = local.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index','trigger') AND sql IS NOT NULL ORDER BY name").all(`ec_${collection}`);
  const expected = schema.filter((item) => item.tbl_name === `ec_${collection}` && item.sql && ['index', 'trigger'].includes(item.type)).map(({type,name,sql}) => ({type,name,sql})).sort((a,b) => a.name.localeCompare(b.name));
  assert.equal(recreated.length, expected.length);
  for (const item of recreated) assert.equal(item.sql.trim(), expected.find((expectedItem) => expectedItem.name === item.name).sql.trim());
}
local.close();
console.log(JSON.stringify({ mode: process.argv.includes('--execute') ? 'execute' : 'validated-plan', statements: plan.length, sha256: digest, summary }, null, 2));
if (!process.argv.includes('--execute')) process.exit(0);
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
assert.equal(config.name, 'sably-emdash-dev'); assert.equal(config.vars.SABLY_ENVIRONMENT, 'development');
const dbId = config.d1_databases.find((item) => item.binding === 'DB').database_id;
assert.equal(dbId, 'd9ed655d-1885-415f-a98e-74d6cd0a6263');
assert(process.env.CLOUDFLARE_API_TOKEN, 'Cloudflare token must be present only in the process environment');
async function query(batch, allowFailure = false) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${dbId}/query`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ batch }),
  });
  const result = await response.json();
  if (!allowFailure) assert(response.ok && result.success && result.result?.every((item) => item.success), `D1 migration failed: ${JSON.stringify(result.errors ?? []).slice(0, 250)}`);
  return result;
}
// Confirm that the REST batch rolls DDL back before relying on atomic table replacement.
const probe = await query([{sql:'CREATE TABLE _sably_atomic_probe (ok INTEGER CHECK(ok=1))'}, {sql:'INSERT INTO _sably_atomic_probe VALUES(0)'}], true);
assert(!probe.success, 'Rollback probe must fail');
const probeCheck = await query([{sql:"SELECT COUNT(*) AS n FROM sqlite_master WHERE name='_sably_atomic_probe'"}]);
assert.equal(probeCheck.result[0].results[0].n, 0, 'REST batches did not roll back atomically; no editorial migration was applied');
const incoming = await query([{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('ec_courses','ec_course_locales','ec_blog') AND (sql LIKE '%REFERENCES \"ec_courses\"%' OR sql LIKE '%REFERENCES \"ec_course_locales\"%' OR sql LIKE '%REFERENCES \"ec_blog\"%')"}]);
assert.equal(incoming.result[0].results.length, 0, 'Unexpected foreign keys point at editorial tables');
process.loadEnvFile('.dev.vars');
const applied = await fetch('https://dev.sably.co/internal/migrate-emdash', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
  headers: { 'Content-Type': 'application/json', 'X-Sably-Preview-Token': process.env.SABLY_DEV_PASSWORD, 'X-Sably-Migration-Token': process.env.SABLY_MIGRATION_TOKEN },
  body: JSON.stringify({ kind: 'relax-legacy', batchId: `relax-legacy:${digest}`, batch: plan }),
});
const application = await applied.json();
assert(applied.ok, `Native D1 batch failed: ${application.error ?? applied.status}`);
const result = {result: new Array(application.statements)};
const after = await query(names.map((name) => ({sql:`SELECT * FROM ec_${name} ORDER BY id`})));
for (const [index, collection] of names.entries()) {
  const expected = snapshot[index].results.toSorted((a,b) => a.id.localeCompare(b.id));
  assert.equal(after.result[index].results.length, expected.length);
  for (const [rowIndex, row] of after.result[index].results.entries()) for (const key of Object.keys(expected[rowIndex])) assert.deepEqual(row[key], expected[rowIndex][key], `Preserved pilot mismatch: ${collection}/${key}`);
}
await writeFile('.emdash/relax-legacy-result.json', `${JSON.stringify({ sha256: digest, statements: result.result.length, verified: true, summary }, null, 2)}\n`, {mode:0o600});
console.log(JSON.stringify({ applied: true, verified: true, statements: result.result.length, sha256: digest }));
