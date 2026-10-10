import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const dataDirectory = resolve(process.env.SABLY_DATA_DIR || './data');
if (!/^emdash_enc_v1_[A-Za-z0-9_-]{43}$/.test(process.env.EMDASH_ENCRYPTION_KEY || '')) {
  throw new Error('A valid EMDASH_ENCRYPTION_KEY is required; preserve the existing key material when migrating.');
}
await mkdir(dataDirectory, { recursive: true });
await access(dataDirectory, constants.W_OK);
for (const directory of ['uploads', 'sessions']) await mkdir(resolve(dataDirectory, directory), { recursive: true });
if (process.env.ALLOW_EMPTY_DATABASE !== 'true') {
  for (const database of [process.env.DATABASE_PATH || resolve(dataDirectory, 'emdash.db'), process.env.SABLY_DATABASE_PATH || resolve(dataDirectory, 'sably.db')]) {
    try { await access(database, constants.R_OK | constants.W_OK); }
    catch { throw new Error(`Required persistent database is missing or not writable: ${database}. Restore the migration backup before starting.`); }
  }
}
await import('../dist/server/entry.mjs');
