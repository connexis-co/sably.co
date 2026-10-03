import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createCatalogD1, reconcileDevelopmentCatalog } from './sync-catalog.mjs';
import { readTarget } from './environment-config.mjs';

export function catalogFixture(cms) {
  const ops = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) ops.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  ops.exec(readFileSync(new URL('../src/plugins/sably-operations/migration.sql', import.meta.url), 'utf8'));
  const development = readTarget('development'), calls = [];
  const fetcher = async (url, options) => {
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-cloudflare-token');
    assert.equal(options.redirect, 'error');
    const database = development.d1_databases.find(item => url.endsWith(`/${item.database_id}/query`));
    assert(database, 'Only pinned development D1 databases may be accessed');
    const db = database.binding === 'DB' ? cms : ops;
    const payload = JSON.parse(options.body), batch = payload.batch ?? [payload];
    calls.push({ binding: database.binding, batch });
    db.exec('BEGIN');
    try {
      const result = batch.map(({ sql, params }) => {
        const statement = db.prepare(sql);
        if (/^SELECT/.test(sql)) return { success: true, results: statement.all(...params), meta: {} };
        const written = statement.run(...params);
        return { success: true, results: [], meta: { changes: Number(written.changes) } };
      });
      db.exec('COMMIT');
      return Response.json({ success: true, result });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return { ops, development, calls, fetcher };
}

test('catalog REST adapter rejects production, CMS mutations and private operational access before fetching', async () => {
  const development = readTarget('development');
  const forbidden = async () => { throw new Error('Must not fetch'); };
  assert.throws(() => createCatalogD1(readTarget('production'), 'SABLY_DB', 'test', forbidden));
  const swapped = structuredClone(development); swapped.d1_databases[1].database_id = swapped.d1_databases[0].database_id;
  assert.throws(() => createCatalogD1(swapped, 'SABLY_DB', 'test', forbidden));
  const cms = createCatalogD1(development, 'DB', 'test', forbidden), ops = createCatalogD1(development, 'SABLY_DB', 'test', forbidden);
  for (const sql of ['DELETE FROM ec_courses', 'SELECT * FROM users', 'SELECT * FROM revisions', 'SELECT * FROM ec_courses']) assert.throws(() => cms.prepare(sql));
  for (const sql of ['SELECT * FROM lead', 'SELECT * FROM purchase', 'SELECT * FROM comment', 'DELETE FROM subject', 'UPDATE subject SET slug=?', 'SELECT * FROM hotmart_eventos']) assert.throws(() => ops.prepare(sql));
  await assert.rejects(() => ops.batch([cms.prepare("SELECT id,slug,title,'' AS hotmart_url FROM ec_blog WHERE status='published' AND deleted_at IS NULL AND locale='es' ORDER BY slug")]), /different database/);
});

test('post-import reconciliation creates new subjects and deactivates withdrawn entries without runtime hooks or private writes', async () => {
  const cms = new DatabaseSync(':memory:');
  cms.exec("CREATE TABLE ec_courses(id TEXT,slug TEXT,title TEXT,hotmart_url TEXT,status TEXT,locale TEXT,deleted_at TEXT); CREATE TABLE ec_blog(id TEXT,slug TEXT,title TEXT,status TEXT,locale TEXT,deleted_at TEXT); INSERT INTO ec_courses VALUES ('old','withdrawn','Retirado','https://go.hotmart.com/OLD','published','es',NULL); INSERT INTO ec_blog VALUES ('post','post','Artículo','published','es',NULL)");
  const f = catalogFixture(cms);
  try {
    await reconcileDevelopmentCatalog(f.development, 'test-cloudflare-token', f.fetcher);
    f.ops.exec("INSERT INTO hotmart_producto(slug,pay_url) VALUES ('withdrawn','https://pay.hotmart.com/OLD'); INSERT INTO hotmart_precio(slug,moneda,monto) VALUES ('withdrawn','USD',42); INSERT INTO hotmart_valoracion(slug,rating,total) VALUES ('withdrawn',5,3)");
    // Equivalent to a native seed import: the CMS changes without firing hooks.
    cms.exec("UPDATE ec_courses SET status='draft' WHERE id='old'; INSERT INTO ec_courses VALUES ('new','new-course','Nuevo','https://go.hotmart.com/NEW','published','es',NULL); INSERT INTO ec_courses VALUES ('draft','unpublished','Borrador','','draft','es',NULL)");
    const report = await reconcileDevelopmentCatalog(f.development, 'test-cloudflare-token', f.fetcher);
    assert.deepEqual(report, { courses: 1, blog: 1, buyableCourses: 1, activeSubjects: 2, verified: true });
    assert.equal(f.ops.prepare("SELECT is_active FROM subject WHERE id='course:new-course'").get().is_active, 1);
    assert.equal(f.ops.prepare("SELECT is_active FROM subject WHERE id='course:withdrawn'").get().is_active, 0);
    assert.equal(f.ops.prepare("SELECT COUNT(*) AS n FROM subject WHERE id='course:unpublished'").get().n, 0);
    for (const table of ['hotmart_producto','hotmart_precio','hotmart_valoracion']) assert.equal(f.ops.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
    assert(f.calls.some(call => call.batch.length > 1), 'Uses native REST batch protocol');
    assert(f.calls.filter(call => call.binding === 'DB').every(call => call.batch.every(query => query.sql.startsWith('SELECT '))), 'CMS remains read-only during derivation');
    assert(!JSON.stringify(f.calls).match(/\b(lead|purchase|comment|hotmart_eventos|users|sessions)\b/), 'No private tables are read or written');
  } finally { f.ops.close(); cms.close(); }
});
