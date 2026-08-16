import {join} from 'path';
import {ensurePath} from '../utils/index.ts';
import Database, {type Statement} from '../utils/sqlite3-async.ts';
import type Tile from '../utils/Tile.ts';

export interface CachedTile {
  data: Buffer;
  lastCheck: Date;
  etag: string;
}

interface TileRow {
  data: Buffer;
  last_check: string;
  etag: string;
}

export default class Cache {
  private readonly db: Database;

  /*
   * Only meaningful for a file-backed cache: a database that did not exist a
   * moment ago cannot hold a tile, so `getTile` skips the lookup entirely.
   * An unnamed cache is in-memory, which the tests use.
   */
  private readonly newCache: boolean;

  /*
   * Prepared in `init()` rather than the constructor, because preparing a
   * statement needs the database open. Every caller awaits `init()` first.
   */
  private insertStatement!: Statement;

  private updateLastCheckStatement!: Statement;

  private selectStatement!: Statement;

  constructor(fileName?: string) {
    if (fileName) {
      const path = join('cache', fileName);
      this.newCache = !ensurePath(path);
      this.db = new Database(path);
    } else {
      this.newCache = false;
      this.db = new Database();
    }
  }

  async init(): Promise<void> {
    await this.db.init();
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS tiles (x integer, y integer, z integer, data blob, last_check DATETIME, etag text, PRIMARY KEY (x, y, z));',
    );
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z);');
    this.insertStatement = await this.db.prepare(
      'INSERT or REPLACE INTO tiles (x, y, z, data, last_check, etag) VALUES ($x, $y, $z, $data, $last_check, $etag);',
    );
    this.updateLastCheckStatement = await this.db.prepare(
      'UPDATE tiles SET last_check = $last_check where x = $x AND y = $y AND z = $z;',
    );
    this.selectStatement = await this.db.prepare(
      'SELECT data, last_check, etag FROM tiles WHERE x = $x AND y = $y AND z = $z;',
    );
  }

  addTile(
    tile: Tile,
    data: Buffer | undefined,
    lastCheck: Date | string | null,
    etag?: string | null,
  ): Promise<void> {
    return this.insertStatement.run({
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom,
      $data: data,
      $last_check: lastCheck,
      $etag: etag,
    });
  }

  updateLastCheck(tile: Tile, lastCheck: Date | string | null): Promise<void> {
    return this.updateLastCheckStatement.run({
      $last_check: lastCheck,
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom,
    });
  }

  async getTile(tile: Tile): Promise<CachedTile | undefined> {
    if (this.newCache) {
      return undefined;
    }

    const row = await this.selectStatement.get<TileRow>({
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom,
    });
    if (row) {
      return {
        data: row.data,
        lastCheck: new Date(row.last_check),
        etag: row.etag,
      };
    }

    return undefined;
  }

  async close(): Promise<void> {
    await this.insertStatement.finalize();
    await this.selectStatement.finalize();
    await this.db.close();
  }
}
