import sqlite3 from 'sqlite3';

/*
 * Named `$placeholder` bindings, which is the only style this codebase uses.
 * `unknown` rather than sqlite3's own value union: callers bind Buffers, Dates
 * and numbers, and every one of them arrives at a driver that coerces.
 */
export type Params = Record<string, unknown>;

/*
 * `promisify` used to build every method on this class at construction time,
 * which left the whole surface untyped — a `promisify`d member is just
 * `Function` to a caller. The wrappers are written out instead: the same
 * callback-to-promise translation, with signatures a caller can be checked
 * against.
 *
 * `run` deliberately resolves with nothing. sqlite3 reports `lastID`/`changes`
 * on the callback's `this`, which a promise cannot carry and no caller here
 * reads.
 */
export class Statement {
  private readonly statement: sqlite3.Statement;

  constructor(statement: sqlite3.Statement) {
    this.statement = statement;
  }

  bind(params: Params = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.statement.bind(params, (error: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  reset(): Promise<void> {
    return new Promise((resolve) => {
      this.statement.reset(() => {
        resolve();
      });
    });
  }

  finalize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.statement.finalize((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  run(params: Params = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.statement.run(params, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  get<T>(params: Params = {}): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.statement.get(params, (error, row: T | undefined) => {
        if (error) {
          reject(error);
        } else {
          resolve(row);
        }
      });
    });
  }

  all<T>(params: Params = {}): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.statement.all(params, (error, rows: T[]) => {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      });
    });
  }

  each<T>(
    callback: (error: Error | null, row: T) => void,
    params: Params = {},
  ) {
    return new Promise<number>((resolve, reject) => {
      this.statement.each(params, callback, (error, num) => {
        if (error) {
          reject(error);
        } else {
          resolve(num);
        }
      });
    });
  }
}

export default class Database {
  private readonly db: sqlite3.Database;

  /*
   * The driver opens asynchronously but hands the object back straight away, so
   * the failure — a bad path, a directory that is not writable — surfaces on
   * this promise rather than out of the constructor. `init()` is what every
   * caller awaits before its first statement.
   */
  private readonly initPromise: Promise<void>;

  constructor(
    fileName = ':memory:',
    mode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  ) {
    let db: sqlite3.Database | undefined;
    this.initPromise = new Promise((resolve, reject) => {
      db = new sqlite3.Database(fileName, mode, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    /*
     * The executor above runs synchronously, so `db` is assigned by the time
     * this line reads it — the non-null assertion is what tells the compiler
     * that, since it cannot see the ordering through the callback.
     */
    this.db = db!;
  }

  /*
   * The driver maintains `open` on the Database object but leaves it out of its
   * .d.ts, hence the cast.
   */
  get open(): boolean {
    return (this.db as unknown as {open: boolean}).open;
  }

  init(): Promise<void> {
    return this.initPromise;
  }

  configure(option: 'busyTimeout' | 'limit', value: number): void {
    this.db.configure(option as 'busyTimeout', value);
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  run(sql: string, params: Params = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  get<T>(sql: string, params: Params = {}): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row: T | undefined) => {
        if (error) {
          reject(error);
        } else {
          resolve(row);
        }
      });
    });
  }

  all<T>(sql: string, params: Params = {}): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows: T[]) => {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      });
    });
  }

  each<T>(
    sql: string,
    callback: (error: Error | null, row: T) => void,
    params: Params = {},
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.each(sql, params, callback, (error, num) => {
        if (error) {
          reject(error);
        } else {
          resolve(num);
        }
      });
    });
  }

  prepare(sql: string, params: Params = {}): Promise<Statement> {
    return new Promise((resolve, reject) => {
      const statement = this.db.prepare(sql, params, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(new Statement(statement));
        }
      });
    });
  }
}
