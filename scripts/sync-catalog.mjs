/** Restricted REST adapter for rebuilding development-only public catalog data. */
import assert from 'node:assert/strict';
import { validateTarget } from './environment-config.mjs';
import { readPublishedCatalog, reconcileCatalog } from '../src/plugins/sably-operations/catalog.ts';

const normalize = sql => sql.trim().replace(/\s+/g, ' ');
const cmsReads = new Set([
  "SELECT id,slug,title,hotmart_url FROM ec_courses WHERE status='published' AND deleted_at IS NULL AND locale='es' ORDER BY slug",
  "SELECT id,slug,title,'' AS hotmart_url FROM ec_blog WHERE status='published' AND deleted_at IS NULL AND locale='es' ORDER BY slug",
]);
const operations = new Set([
  'SELECT content_id,slug,source_url FROM sably_cms_catalog WHERE kind=?',
  'INSERT INTO sably_cms_catalog(kind,content_id,slug,source_url) VALUES(?,?,?,?) ON CONFLICT(kind,content_id) DO UPDATE SET slug=excluded.slug,source_url=excluded.source_url',
  'INSERT INTO subject(id,kind,slug,is_active) VALUES(?,?,?,1) ON CONFLICT(kind,slug) DO UPDATE SET is_active=1',
  'DELETE FROM sably_cms_catalog WHERE kind=? AND content_id NOT IN (SELECT value FROM json_each(?))',
  'UPDATE subject SET is_active=EXISTS(SELECT 1 FROM sably_cms_catalog c WHERE c.kind=subject.kind AND c.slug=subject.slug) WHERE kind=?',
  'SELECT kind,content_id,slug,source_url FROM sably_cms_catalog ORDER BY kind,content_id',
  "SELECT kind,slug,is_active FROM subject WHERE kind IN ('course','blog') ORDER BY kind,slug",
  ...['hotmart_producto', 'hotmart_precio', 'hotmart_valoracion'].flatMap(table => [
    `DELETE FROM ${table} WHERE slug=?`,
    `DELETE FROM ${table} WHERE slug NOT IN (SELECT value FROM json_each(?))`,
  ]),
]);

export function assertCatalogSql(binding, sql, params) {
  assert(binding === 'DB' || binding === 'SABLY_DB', 'Unknown catalog database binding');
  assert((binding === 'DB' ? cmsReads : operations).has(normalize(sql)), 'Query is outside the derived development catalog allowlist');
  if (params !== undefined) {
    assert.equal(params.length, (sql.match(/\?/g) ?? []).length, 'Catalog parameter count mismatch');
    assert(params.length <= 100 && params.every(value => typeof value === 'string'), 'Catalog queries only accept bounded string parameters');
  }
}

export function createCatalogD1(development, binding, token, fetcher = fetch) {
  validateTarget('development', development, development);
  assert(binding === 'DB' || binding === 'SABLY_DB', 'Unknown catalog database binding');
  const cmsId = development.d1_databases.find(item => item.binding === 'DB').database_id;
  const opsId = development.d1_databases.find(item => item.binding === 'SABLY_DB').database_id;
  assert.notEqual(cmsId, opsId, 'CMS and operational databases must be isolated');
  assert(token, 'CLOUDFLARE_API_TOKEN is required');
  const url = `https://api.cloudflare.com/client/v4/accounts/${development.account_id}/d1/database/${binding === 'DB' ? cmsId : opsId}/query`;
  const prepared = new WeakMap();
  async function execute(statements) {
    assert(statements.length > 0 && statements.length <= 50, 'Catalog batches must contain 1–50 statements');
    const batch = statements.map(statement => {
      const query = prepared.get(statement);
      assert(query, 'Catalog statement belongs to a different database');
      assertCatalogSql(binding, query.sql, query.params);
      return query;
    });
    // Official D1 REST protocol: {batch:[{sql,params}]}, not SQL concatenation.
    // https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
    const response = await fetcher(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.length === 1 ? batch[0] : { batch }),
    });
    assert(response.ok, `Catalog D1 request failed: HTTP ${response.status}`);
    const payload = await response.json();
    assert(payload.success && payload.result?.length === batch.length && payload.result.every(item => item.success && Array.isArray(item.results)), 'Catalog D1 query failed; provider payload omitted');
    return payload.result;
  }
  function prepare(sql, params = []) {
    assertCatalogSql(binding, sql);
    const statement = {
      bind(...values) { return prepare(sql, values); },
      async all() { return (await execute([statement]))[0]; },
    };
    prepared.set(statement, { sql, params });
    return statement;
  }
  return { prepare, batch: execute };
}

export async function reconcileDevelopmentCatalog(development, token, fetcher = fetch) {
  const cms = createCatalogD1(development, 'DB', token, fetcher);
  const ops = createCatalogD1(development, 'SABLY_DB', token, fetcher);
  const buyable = await reconcileCatalog(cms, ops);
  const expected = [];
  for (const kind of ['course', 'blog']) {
    for (const row of await readPublishedCatalog(cms, kind)) expected.push({ kind, content_id: row.id, slug: row.slug, source_url: row.hotmart_url ?? '' });
  }
  const actual = (await ops.prepare('SELECT kind,content_id,slug,source_url FROM sably_cms_catalog ORDER BY kind,content_id').all()).results;
  const stable = rows => JSON.stringify(rows.map(row => [row.kind, row.content_id, row.slug, row.source_url]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  assert.equal(stable(actual), stable(expected), 'Derived catalog does not match published development content');
  const active = (await ops.prepare("SELECT kind,slug,is_active FROM subject WHERE kind IN ('course','blog') ORDER BY kind,slug").all()).results.filter(row => row.is_active === 1);
  const keys = rows => rows.map(row => `${row.kind}:${row.slug}`).sort();
  assert.deepEqual(keys(active), keys(expected), 'Derived active subjects do not match published development content');
  return { courses: expected.filter(row => row.kind === 'course').length, blog: expected.filter(row => row.kind === 'blog').length, buyableCourses: buyable.length, activeSubjects: active.length, verified: true };
}
