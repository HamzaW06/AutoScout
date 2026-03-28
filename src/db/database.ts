import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = 'data/autoscout.db';

let dbInstance: Database | null = null;

export class Database {
  private db: SqlJsDatabase;
  private dbPath: string;

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  /** Execute SQL that modifies data (INSERT/UPDATE/DELETE). Auto-saves after. */
  run(sql: string, params?: unknown[]): void {
    this.db.run(sql, params as never[]);
    this.saveToFile();
  }

  /** Get a single row. Returns undefined if no rows match. */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
    const stmt = this.db.prepare(sql);
    try {
      if (params) {
        stmt.bind(params as never[]);
      }
      if (stmt.step()) {
        return stmt.getAsObject() as T;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /** Get all matching rows. */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    const results: T[] = [];
    try {
      if (params) {
        stmt.bind(params as never[]);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  /** Execute raw SQL (for schema creation, multi-statement scripts, etc.). Auto-saves after. */
  exec(sql: string): void {
    this.db.exec(sql);
    this.saveToFile();
  }

  /** Wrap multiple operations in a transaction. Auto-saves once at the end. */
  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.db.run('COMMIT');
      this.saveToFile();
      return result;
    } catch (err) {
      this.db.run('ROLLBACK');
      throw err;
    }
  }

  /** Persist the current database state to disk. */
  saveToFile(): void {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = this.db.export();
    writeFileSync(this.dbPath, Buffer.from(data));
  }

  /** Save to disk and close the database. */
  close(): void {
    this.saveToFile();
    this.db.close();
    dbInstance = null;
  }
}

/**
 * Initialize sql.js WASM engine and open (or create) the database file.
 * Sets recommended pragmas for reliability.
 */
export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  let sqlDb: SqlJsDatabase;

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // sql.js operates in-memory so WAL is not supported; use DELETE journal mode.
  sqlDb.run('PRAGMA journal_mode = DELETE');
  sqlDb.run('PRAGMA busy_timeout = 5000');
  sqlDb.run('PRAGMA foreign_keys = ON');

  const db = new Database(sqlDb, DB_PATH);
  dbInstance = db;

  // Ensure the data directory and initial file exist
  db.saveToFile();

  return db;
}

/** Get the singleton Database instance. Throws if not yet initialized. */
export function getDb(): Database {
  if (!dbInstance) {
    throw new Error(
      'Database not initialized. Call initDatabase() from schema.ts first.',
    );
  }
  return dbInstance;
}
