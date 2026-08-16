import {DatabaseSync, type StatementSync} from 'node:sqlite';
import {join} from 'path';
import {ensurePath} from '../utils/index.ts';
import type Tile from '../utils/Tile.ts';
import WriteBatch from '../utils/WriteBatch.ts';

export interface CachedTile {
  data: Uint8Array;
  lastCheck: Date;
  etag: string;
}

/*
 * The column holds the response's `Date` header verbatim in the normal path,
 * and epoch milliseconds when a Date is handed in — which is exactly what the
 * `sqlite3` package wrote for a Date binding, so caches written before the
 * move to node:sqlite still read back through `new Date`. The conversion lives
 * here because node:sqlite refuses a Date outright, and this is the one column
 * that takes one.
 */
function toStoredDate(lastCheck: Date | string | null): string | number | null {
  return lastCheck instanceof Date ? lastCheck.getTime() : lastCheck;
}

export default class Cache {
  private readonly db: DatabaseSync;

  private readonly batch: WriteBatch;

  /*
   * Only meaningful for a file-backed cache: a database that did not exist a
   * moment ago cannot hold a tile, so `getTile` skips the lookup entirely.
   * An unnamed cache is in-memory, which the tests use.
   */
  private readonly newCache: boolean;

  /*
   * Prepared in `init()` rather than the constructor, because the tables have
   * to exist first. Every caller calls `init()` before its first lookup.
   */
  private insertStatement!: StatementSync;

  private updateLastCheckStatement!: StatementSync;

  private selectStatement!: StatementSync;

  constructor(fileName?: string) {
    if (fileName) {
      const path = join('cache', fileName);
      this.newCache = !ensurePath(path);
      this.db = new DatabaseSync(path);
    } else {
      this.newCache = false;
      this.db = new DatabaseSync(':memory:');
    }

    this.batch = new WriteBatch(this.db);
  }

  init(): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS tiles (x integer, y integer, z integer, data blob, last_check DATETIME, etag text, PRIMARY KEY (x, y, z));',
    );
    this.db.exec('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z);');
    this.insertStatement = this.db.prepare(
      'INSERT or REPLACE INTO tiles (x, y, z, data, last_check, etag) VALUES ($x, $y, $z, $data, $last_check, $etag);',
    );
    this.updateLastCheckStatement = this.db.prepare(
      'UPDATE tiles SET last_check = $last_check where x = $x AND y = $y AND z = $z;',
    );
    this.selectStatement = this.db.prepare(
      'SELECT data, last_check, etag FROM tiles WHERE x = $x AND y = $y AND z = $z;',
    );
  }

  addTile(
    tile: Tile,
    data: Uint8Array | undefined,
    lastCheck: Date | string | null,
    etag?: string | null,
  ): void {
    this.batch.write(() => {
      this.insertStatement.run({
        $x: tile.x,
        $y: tile.y,
        $z: tile.zoom,
        // `?? null` throughout: null binds, undefined is rejected
        $data: data ?? null,
        $last_check: toStoredDate(lastCheck),
        $etag: etag ?? null,
      });
    });
  }

  updateLastCheck(tile: Tile, lastCheck: Date | string | null): void {
    this.batch.write(() => {
      this.updateLastCheckStatement.run({
        $last_check: toStoredDate(lastCheck),
        $x: tile.x,
        $y: tile.y,
        $z: tile.zoom,
      });
    });
  }

  getTile(tile: Tile): CachedTile | undefined {
    if (this.newCache) {
      return undefined;
    }

    /*
     * Reads run on the same connection as the open batch, so they see its
     * uncommitted writes — a tile stored earlier in this job is found even
     * though its transaction has not been committed yet.
     */
    const row = this.selectStatement.get({
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom,
    });
    if (!row) {
      return undefined;
    }

    return {
      data: row.data as Uint8Array,
      lastCheck: new Date(row.last_check as string | number),
      etag: row.etag as string,
    };
  }

  close(): void {
    this.batch.flush();
    this.db.close();
  }
}
