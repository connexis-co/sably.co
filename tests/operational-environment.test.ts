import assert from 'node:assert/strict';
import test from 'node:test';
import { availableOperationalDatabase, type OperationalBindings } from '../src/lib/operational-environment';

test('public and administrative operations share the same fail-closed activation and D1 boundary', () => {
  const db = { prepare() { throw new Error('Guard must not query D1'); }, async batch() { return []; } } as unknown as D1Database;
  const cms = { prepare() { throw new Error('CMS must not be queried'); }, async batch() { return []; } } as unknown as D1Database;
  const active: OperationalBindings = { DB: cms, SABLY_DB: db, SABLY_ENVIRONMENT: 'production', SABLY_CMS_READY: 'true', SABLY_PRODUCTION_ACTIVATED: 'true' };
  const adminUrl = 'https://sably.co/_emdash/api/plugins/sably-operations/leads';
  assert.equal(availableOperationalDatabase(active, adminUrl), db);
  for (const env of [
    { ...active, SABLY_ENVIRONMENT: undefined }, { ...active, SABLY_CMS_READY: 'false' },
    { ...active, SABLY_PRODUCTION_ACTIVATED: 'false' }, { ...active, SABLY_DB: cms },
    { ...active, SABLY_DB: undefined }, { ...active, SABLY_DB: {} as D1Database },
    { ...active, SABLY_ENVIRONMENT: 'development' },
  ]) assert.equal(availableOperationalDatabase(env, adminUrl), null);
  for (const url of ['invalid', 'https://dev.sably.co/', 'https://example.workers.dev/']) assert.equal(availableOperationalDatabase(active, url), null);
  assert.equal(availableOperationalDatabase({ ...active, SABLY_ENVIRONMENT: 'development', SABLY_PRODUCTION_ACTIVATED: 'false' }, 'https://dev.sably.co/'), db);
});
