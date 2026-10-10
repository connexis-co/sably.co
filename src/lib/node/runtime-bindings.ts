import { resolve } from 'node:path';
import { SqliteD1Database } from './d1-sqlite';

const databases = new Map<string, SqliteD1Database>();
function database(path: string): D1Database {
  const filename = resolve(path.replace(/^file:/, ''));
  let db = databases.get(filename);
  if (!db) { db = new SqliteD1Database(filename); databases.set(filename, db); }
  // The legacy app only uses prepare/batch/exec. EmDash itself uses its native
  // SQLite dialect; its migrations and queries never go through this adapter.
  return db as unknown as D1Database;
}

/** Lazy getters avoid creating production data files while Astro builds. */
export const env = {
  ...process.env,
  get DB() { return database(process.env.DATABASE_PATH || resolve(process.env.SABLY_DATA_DIR || './data', 'emdash.db')); },
  get SABLY_DB() { return database(process.env.SABLY_DATABASE_PATH || resolve(process.env.SABLY_DATA_DIR || './data', 'sably.db')); },
};
