#!/usr/bin/env node
/** Repeatable SABLY_DB bootstrap. Never connects unless --execute is explicit. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { targetConfig, validateTarget } from './environment-config.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = '_sably_operations_migrations';
const PLUGIN = 'src/plugins/sably-operations';
const SEEDS = ['calendar-seed.sql', 'public-settings-seed.sql', 'public-data-seed.sql'];
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;

export function parseArgs(args) {
  let target, execute = false, dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && target === undefined) target = args[++i];
    else if (args[i] === '--execute') execute = true;
    else if (args[i] === '--dry-run') dryRun = true;
    else throw new Error(`Unsupported argument: ${args[i]}`);
  }
  assert.ok(target === 'development' || target === 'production', 'Use --target development|production');
  assert.ok(!(execute && dryRun), 'Choose --execute or --dry-run, not both');
  return { target, execute };
}

/** SQL splitter for the checked-in migrations; quoted semicolons/comments survive. */
export function splitSQL(source) {
  const statements = [];
  let current = '', quote = '', lineComment = false, blockComment = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (lineComment) { if (c === '\n') { lineComment = false; current += '\n'; } continue; }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++; current += ' '; } continue; }
    if (quote) {
      current += c;
      if (c === quote) { if (next === quote) current += source[++i]; else quote = ''; }
      continue;
    }
    if (c === '-' && next === '-') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; current += c; continue; }
    if (c === ';') { if (current.trim()) statements.push(current.trim() + ';'); current = ''; }
    else current += c;
  }
  assert.ok(!quote && !blockComment, 'Unterminated SQL quote/comment');
  if (current.trim()) statements.push(current.trim() + ';');
  return statements;
}

export function validateOperationalTarget(target, config, development, root = ROOT) {
  const spec = validateTarget(target, config, development);
  const operational = config.d1_databases.filter(item => item.binding === 'SABLY_DB');
  assert.equal(operational.length, 1, 'Exactly one SABLY_DB binding is required');
  const database = operational[0];
  assert.notEqual(database.database_id, config.d1_databases.find(item => item.binding === 'DB')?.database_id, 'SABLY_DB must never be the EmDash DB');
  assert.equal(database.database_name, target === 'development' ? 'sably-pulso-dev' : 'sably-operations-production', 'Unexpected operational database name');
  assert.equal(resolve(root, dirname(spec.configPath), database.migrations_dir ?? ''), resolve(root, 'migrations'), 'Only the reviewed legacy migrations directory is allowed');
  return { ...spec, database };
}

/** Existing columns are adopted, supporting the first manually applied dev schema. */
export function planPluginSchema(source, inventory) {
  const tables = new Set(inventory.tables), indexes = new Set(inventory.indexes);
  const columns = new Map(Object.entries(inventory.columns).map(([name, values]) => [name, new Set(values)]));
  const pending = [];
  for (const sql of splitSQL(source)) {
    const alter = sql.match(/^ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s/i);
    const create = sql.match(/^CREATE\s+(TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*[ (]/i);
    if (alter) {
      assert.ok(tables.has(alter[1]), `Legacy table ${alter[1]} is missing`);
      const names = columns.get(alter[1]) ?? new Set();
      if (!names.has(alter[2])) { pending.push(sql); names.add(alter[2]); columns.set(alter[1], names); }
    } else if (create) {
      const existing = create[1].toUpperCase() === 'TABLE' ? tables : indexes;
      if (!existing.has(create[2])) {
        pending.push(sql.replace(/^CREATE\s+(TABLE|INDEX)\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE $1 IF NOT EXISTS '));
        existing.add(create[2]);
      }
    } else throw new Error('Unsupported plugin schema statement; add an explicit migration handler');
  }
  return pending;
}

/** Settings baseline can only initialize a database which this runner found empty. */
export function planSeed(name, source, bootstrapMode, prior) {
  const sha256 = hash(source);
  if (prior) {
    assert.equal(prior.sha256, sha256, `Previously applied ${name} changed; create a versioned migration instead of replaying seeds`);
    return null;
  }
  if (name === 'public-settings-seed.sql' && bootstrapMode !== 'fresh') return { mode: 'adopted', sha256, statements: [] };
  const statements = splitSQL(source);
  if (name !== 'public-settings-seed.sql') {
    assert.ok(statements.every(sql => /^INSERT\s+OR\s+IGNORE\s+INTO\s/i.test(sql)), `${name} must only add missing rows`);
  }
  return { mode: 'applied', sha256, statements };
}

function defaultRunner(args, { root = ROOT } = {}) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.error || result.status !== 0) {
    // SQL/CLI output can include row data; do not echo it into deployment logs.
    throw new Error(`Wrangler ${args.slice(0, 3).join(' ')} failed (exit ${result.status ?? 'unknown'}); inspect the protected Wrangler log`);
  }
  return result.stdout;
}

export function applyOperationalSchema({ target, execute = false, root = ROOT, run = defaultRunner, log = console.log }) {
  const spec = targetConfig(target);
  const config = JSON.parse(readFileSync(resolve(root, spec.configPath), 'utf8'));
  const development = JSON.parse(readFileSync(resolve(root, targetConfig('development').configPath), 'utf8'));
  const { database } = validateOperationalTarget(target, config, development, root);
  const schema = readFileSync(join(root, PLUGIN, 'migration.sql'), 'utf8');
  const seeds = SEEDS.map(name => ({ name, source: readFileSync(join(root, PLUGIN, name), 'utf8') }));
  const plan = {
    target, binding: 'SABLY_DB', database: database.database_name, databaseId: database.database_id,
    execute, legacyMigrations: readdirSync(join(root, 'migrations')).filter(name => name.endsWith('.sql')).sort(),
    pluginSchemaSha256: hash(schema), seeds: seeds.map(({ name, source }) => ({ name, sha256: hash(source) })),
  };
  if (!execute) { log(JSON.stringify({ ...plan, notice: 'Offline plan only. --execute inspects the remote schema and applies missing changes; existing settings are preserved.' }, null, 2)); return plan; }
  const common = ['--config', resolve(root, spec.configPath), '--remote'];
  const query = sql => {
    const output = run(['d1', 'execute', 'SABLY_DB', ...common, '--json', '--command', sql], { root });
    let parsed;
    try { parsed = typeof output === 'string' ? JSON.parse(output) : output; } catch { throw new Error('Wrangler did not return JSON; no schema assumptions were made'); }
    assert.ok(Array.isArray(parsed) && parsed.every(item => item.success !== false && Array.isArray(item.results)), 'D1 schema query failed');
    return parsed.flatMap(item => item.results);
  };
  const write = statements => {
    if (!statements.length) return;
    const directory = mkdtempSync(join(tmpdir(), 'sably-schema-'));
    try {
      const file = join(directory, 'migration.sql');
      writeFileSync(file, statements.join('\n') + '\n', { mode: 0o600 });
      run(['d1', 'execute', 'SABLY_DB', ...common, '--json', '--file', file, '--yes'], { root });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  };
  const objects = () => query("SELECT name,type FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'");
  const initial = objects();
  write([`CREATE TABLE IF NOT EXISTS ${LEDGER} (id TEXT PRIMARY KEY,sha256 TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('fresh','adopted','applied')),applied_at INTEGER NOT NULL DEFAULT (unixepoch()));`]);
  const ledger = new Map(query(`SELECT id,sha256,mode FROM ${LEDGER}`).map(row => [row.id, row]));
  const record = (id, sha256, mode) => `INSERT OR IGNORE INTO ${LEDGER} (id,sha256,mode) VALUES (${literal(id)},${literal(sha256)},${literal(mode)});`;
  if (!ledger.has('bootstrap-v1')) {
    const mode = initial.some(row => row.type === 'table' && ![LEDGER, 'd1_migrations', '_cf_KV'].includes(row.name)) ? 'adopted' : 'fresh';
    write([record('bootstrap-v1', '', mode)]);
    ledger.set('bootstrap-v1', { mode });
  }
  run(['d1', 'migrations', 'apply', 'SABLY_DB', ...common], { root });
  const afterLegacy = objects();
  const inventory = {
    tables: afterLegacy.filter(row => row.type === 'table').map(row => row.name),
    indexes: afterLegacy.filter(row => row.type === 'index').map(row => row.name),
    columns: { promocion: query('PRAGMA table_info(promocion)').map(row => row.name) },
  };
  const pending = planPluginSchema(schema, inventory);
  write(pending);
  log(`${target}: legacy migrations checked; ${pending.length} missing plugin schema statements applied.`);
  for (const { name, source } of seeds) {
    const seed = planSeed(name, source, ledger.get('bootstrap-v1').mode, ledger.get(name));
    if (!seed) { log(`${name}: already recorded, unchanged.`); continue; }
    write([...seed.statements, record(name, seed.sha256, seed.mode)]);
    log(`${name}: ${seed.mode === 'adopted' ? 'existing settings adopted without overwriting' : 'missing initial data applied'}.`);
  }
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { applyOperationalSchema(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
