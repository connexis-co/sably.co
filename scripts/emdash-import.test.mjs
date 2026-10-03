import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedMediaSource, authorizeMigration, canonicalJson, isPilotEntry, readLimited, snapshotHash } from '../src/lib/emdash-migration-guard.ts';

test('temporary importer requires a development host, environment and separate strong secret', async () => {
  const token = 'unit-test-token-not-a-real-secret-000000000000';
  const request = (url, supplied = token) => new Request(url, { headers: { 'X-Sably-Migration-Token': supplied } });
  const environment = { SABLY_ENVIRONMENT: 'development', SABLY_MIGRATION_TOKEN: token };
  assert.equal(await authorizeMigration(request('https://dev.sably.co/internal/migrate-emdash'), environment), true);
  assert.equal(await authorizeMigration(request('https://sably.co/internal/migrate-emdash'), environment), false);
  assert.equal(await authorizeMigration(request('https://dev.sably.co.evil.example/internal/migrate-emdash'), environment), false);
  assert.equal(await authorizeMigration(request('https://dev.sably.co/internal/migrate-emdash'), { ...environment, SABLY_ENVIRONMENT: 'production' }), false);
  assert.equal(await authorizeMigration(request('https://dev.sably.co/internal/migrate-emdash', 'incorrect'), environment), false);
  assert.equal(await authorizeMigration(request('https://dev.sably.co/internal/migrate-emdash'), { ...environment, SABLY_MIGRATION_TOKEN: 'short' }), false);
});

test('media source allowlist rejects local networks, credentials and lookalike domains', () => {
  assert(allowedMediaSource('https://cdn.sably.co/covers/belleza.jpg'));
  for (const url of ['http://127.0.0.1/image.png', 'https://cdn.sably.co.evil.test/a.jpg', 'https://x:pass@sably.co/a.png', 'https://sably.co:8443/a.png', 'data:image/svg+xml,test']) assert.equal(allowedMediaSource(url), false);
});

test('snapshot preconditions are stable and detect changed published values', async () => {
  const fields = ['title', 'modules', 'version'];
  const row = { title: 'Curso', modules: '[{"title":"Uno","lessons":["A","B"]}]', version: 2 };
  assert.equal(await snapshotHash(row, fields), await snapshotHash({ ...row, modules: JSON.parse(row.modules) }, [...fields].reverse()));
  assert.notEqual(await snapshotHash(row, fields), await snapshotHash({ ...row, title: 'Nueva edición' }, fields));
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert(isPilotEntry('courses', 'curso-de-barberia'));
  assert.equal(isPilotEntry('courses', 'curso-de-panaderia'), false);
});

test('request reader enforces the byte cap even without Content-Length', async () => {
  const request = new Request('http://localhost/import', { method: 'POST', body: new Uint8Array(100), duplex: 'half' });
  await assert.rejects(() => readLimited(request, 10), /limit/);
  assert.equal((await readLimited(new Request('http://localhost/import', { method: 'POST', body: 'abc' }), 3)).length, 3);
});
