import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from 'node:sqlite';

/*
 * Named `$placeholder` bindings, which is the only style this codebase uses.
 * `unknown` rather than node:sqlite's own `SQLInputValue`: callers bind
 * Dates and `undefined`, which the driver rejects and `normalizeParams` below
 * translates.
 */
export type Params = Record<string, unknown>;

export interface DatabaseOptions {
  readOnly?: boolean;
}

/*
 * Node:sqlite binds only null, number, bigint, string and Uint8Array — it
 * throws ERR_INVALID_ARG_TYPE on anything else, where the `sqlite3` package
 * this replaces coerced silently. Two of its coercions are load-bearing here:
 *
 * - `undefined` becomes NULL. Cache.addTile passes an absent tile body, and
 *   MBTilesPackager.setMetadata an absent attribution, as `undefined`.
 * - A Date becomes epoch milliseconds. That is exactly what `sqlite3` wrote
 *   for a Date binding — an integer, verified against it — so cache files
 *   written before this change still read back through `new Date(value)`.
 */
function normalizeParams(params: Params): Record<string, SQLInputValue> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (value === undefined) {
        return [key, null];
      }

      if (value instanceof Date) {
        return [key, value.getTime()];
      }

      return [key, value as SQLInputValue];
    }),
  );
}

/*
 * Node:sqlite is synchronous — there is no async variant of it. This class
 * stays promise-returning anyway, because it is the seam every caller is
 * written against: Cache, the packagers and MBSource all await these methods,
 * and none of them had to change.
 *
 * `run` deliberately resolves with nothing. The driver reports
 * `changes`/`lastInsertRowid`, which no caller here reads.
 */
export class Statement {
  private readonly statement: StatementSync;

  constructor(statement: StatementSync) {
    this.statement = statement;
  }

  /*
   * A no-op, kept because the packagers and Cache call it before closing.
   * node:sqlite has no finalize: a statement is released when it is garbage
   * collected, and closing the database invalidates any that are still live.
   */
  finalize(): Promise<void> {
    return Promise.resolve();
  }

  run(params: Params = {}): Promise<void> {
    this.statement.run(normalizeParams(params));
    return Promise.resolve();
  }

  get<T>(params: Params = {}): Promise<T | undefined> {
    return Promise.resolve(
      this.statement.get(normalizeParams(params)) as T | undefined,
    );
  }

  all<T>(params: Params = {}): Promise<T[]> {
    return Promise.resolve(this.statement.all(normalizeParams(params)) as T[]);
  }
}

export default class Database {
  private readonly db: DatabaseSync;

  /*
   * The `sqlite3` package opened in the background and reported failure to a
   * callback, so a bad path surfaced at `init()` rather than out of the
   * constructor. node:sqlite throws from its constructor instead, so the open
   * is deferred with `{open: false}`, done eagerly here, and the error held
   * back until `init()` — which keeps that contract, and keeps `open` true
   * from the moment a working database is constructed.
   */
  private readonly openError?: Error;

  constructor(fileName = ':memory:', {readOnly = false}: DatabaseOptions = {}) {
    this.db = new DatabaseSync(fileName, {open: false, readOnly});
    try {
      this.db.open();
    } catch (error) {
      this.openError = error as Error;
    }
  }

  get open(): boolean {
    return this.db.isOpen;
  }

  init(): Promise<void> {
    return this.openError ? Promise.reject(this.openError) : Promise.resolve();
  }

  close(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }

  /*
   * The only entry point that runs more than one statement, which is why
   * BCNavPackager's two-statement close goes through it rather than `run`.
   */
  exec(sql: string): Promise<void> {
    this.db.exec(sql);
    return Promise.resolve();
  }

  run(sql: string, params: Params = {}): Promise<void> {
    this.db.prepare(sql).run(normalizeParams(params));
    return Promise.resolve();
  }

  get<T>(sql: string, params: Params = {}): Promise<T | undefined> {
    return Promise.resolve(
      this.db.prepare(sql).get(normalizeParams(params)) as T | undefined,
    );
  }

  all<T>(sql: string, params: Params = {}): Promise<T[]> {
    return Promise.resolve(
      this.db.prepare(sql).all(normalizeParams(params)) as T[],
    );
  }

  prepare(sql: string): Promise<Statement> {
    return Promise.resolve(new Statement(this.db.prepare(sql)));
  }
}
