import type {StatementSync} from 'node:sqlite';
import {format} from 'path';
import type Tile from '../utils/Tile.ts';
import DatabasePackager from './DatabasePackager.ts';

export default class BCNavPackager extends DatabasePackager {
  private insertStatement!: StatementSync;

  private selectStatement!: StatementSync;

  constructor(fileName: string) {
    super(format({name: fileName, ext: '.sqlitedb'}));
  }

  override get id(): string {
    return `BCNav_${super.id}`;
  }

  override init(): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS tiles (x int, y int, z int, s int, image blob, PRIMARY KEY (x,y,z,s));',
    );
    this.db.exec('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z, s);');
    this.db.exec('CREATE TABLE IF NOT EXISTS info (minzoom int, maxzoom int)');
    this.insertStatement = this.db.prepare(
      'INSERT OR REPLACE INTO tiles (x, y, z, s, image) VALUES ($x, $y, $z, 0, $image);',
    );
    this.selectStatement = this.db.prepare(
      'SELECT COUNT(*) AS result FROM tiles WHERE x = $x AND y = $y and z = $z;',
    );
  }

  override hasTile({x, y, zoom}: Tile): boolean {
    if (this.newFile) {
      return false;
    }

    const $z = 17 - zoom;
    const row = this.selectStatement.get({
      $x: x,
      $y: y,
      $z,
    });
    return row?.result === 1;
  }

  override addTile({x, y, zoom}: Tile, $image: Uint8Array): void {
    const $z = 17 - zoom;
    this.batch.write(() => {
      this.insertStatement.run({
        $x: x,
        $y: y,
        $z,
        $image,
      });
    });
  }

  override close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string> {
    /*
     * `exec` rather than a prepared statement: this is two statements, and
     * `prepare` only ever compiles the first — the INSERT never used to
     * happen, leaving `info` empty. It joins whatever transaction the batch
     * has open, and `closeDatabase` commits it.
     */
    this.db.exec(
      `DELETE FROM info;
       INSERT INTO info(minzoom, maxzoom) VALUES((SELECT MIN(z) FROM tiles), (SELECT MAX(z) FROM tiles));`,
    );
    return this.closeDatabase('BCNav', routeAttribution, tileAttribution);
  }
}
