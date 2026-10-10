import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** The small D1 contract used by the existing operational handlers, on local SQLite. */
export class SqliteD1Database {
  readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  }

  prepare(query: string): SqliteD1Statement {
    return new SqliteD1Statement(this, query);
  }

  async batch<T = unknown>(statements: SqliteD1Statement[]): Promise<D1Result<T>[]> {
    // No await inside this transaction: a different request cannot interleave its
    // queries on this connection or accidentally participate in this batch.
    if (statements.some(statement => statement.owner !== this)) throw new Error('SQLite batch belongs to a different database');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.execute<T>());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    const started = performance.now();
    this.database.exec(query);
    return { count: 1, duration: performance.now() - started };
  }

  withSession() {
    return { prepare: this.prepare.bind(this), batch: this.batch.bind(this), getBookmark: () => null };
  }

  close(): void { this.database.close(); }
}

function binding(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value) && value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return new Uint8Array(value);
  throw new TypeError('Unsupported SQLite binding');
}

export class SqliteD1Statement {
  constructor(readonly owner: SqliteD1Database, readonly query: string, private readonly values: SQLInputValue[] = []) {}

  bind(...values: unknown[]): SqliteD1Statement {
    return new SqliteD1Statement(this.owner, this.query, values.map(binding));
  }

  execute<T = Record<string, unknown>>(): D1Result<T> {
    const started = performance.now();
    const statement = this.owner.database.prepare(this.query);
    let results: T[] = [];
    let changes = 0;
    let lastRowId = 0;
    if (statement.columns().length > 0) {
      results = statement.all(...this.values).map(row => ({ ...row })) as T[];
      // INSERT/UPDATE ... RETURNING still write; inspect immediately on this
      // connection, while SELECT must not report the previous write's changes.
      if (/^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(this.query)) {
        const row = this.owner.database.prepare('SELECT changes() AS changes, last_insert_rowid() AS id').get()!;
        changes = Number(row.changes); lastRowId = Number(row.id);
      }
    } else {
      const result = statement.run(...this.values);
      changes = Number(result.changes); lastRowId = Number(result.lastInsertRowid);
    }
    return { success: true, results, meta: {
      duration: performance.now() - started, changes, last_row_id: lastRowId,
      changed_db: changes > 0, rows_read: results.length, rows_written: changes, size_after: 0,
    } };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> { return this.execute<T>(); }
  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> { return this.execute<T>(); }
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.owner.database.prepare(this.query).get(...this.values);
    if (!row) return null;
    if (column !== undefined) {
      if (!Object.hasOwn(row, column)) throw new Error(`Column not found: ${column}`);
      return row[column] as T;
    }
    return { ...row } as T;
  }
  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    const statement = this.owner.database.prepare(this.query);
    const columns = statement.columns().map(column => column.name);
    const rows = statement.all(...this.values).map(row => columns.map(column => row[column])) as T[];
    return options?.columnNames ? [columns, ...rows] : rows;
  }
}
