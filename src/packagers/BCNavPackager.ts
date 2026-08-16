import {format} from 'path';
import type {Statement} from '../utils/sqlite3-async.ts';
import type Tile from '../utils/Tile.ts';
import DatabasePackager from './DatabasePackager.ts';

interface CountRow {
  result: number;
}

export default class BCNavPackager extends DatabasePackager {
  private insertStatement!: Statement;

  private selectStatement!: Statement;

  constructor(fileName: string) {
    super(format({name: fileName, ext: '.sqlitedb'}));
  }

  override get id(): string {
    return `BCNav_${super.id}`;
  }

  override async init(): Promise<void> {
    await super.init();
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS tiles (x int, y int, z int, s int, image blob, PRIMARY KEY (x,y,z,s));',
    );
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z, s);');
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS info (minzoom int, maxzoom int)',
    );
    this.insertStatement = await this.db.prepare(
      'INSERT OR REPLACE INTO tiles (x, y, z, s, image) VALUES ($x, $y, $z, 0, $image);',
    );
    this.selectStatement = await this.db.prepare(
      'SELECT COUNT(*) AS result FROM tiles WHERE x = $x AND y = $y and z = $z;',
    );
  }

  override async hasTile({x, y, zoom}: Tile): Promise<boolean> {
    if (this.newFile) {
      return false;
    }

    const $z = 17 - zoom;
    const row = await this.selectStatement.get<CountRow>({
      $x: x,
      $y: y,
      $z,
    });
    return row?.result === 1;
  }

  override addTile({x, y, zoom}: Tile, $image: Buffer): Promise<void> {
    const $z = 17 - zoom;
    return this.insertStatement.run({
      $x: x,
      $y: y,
      $z,
      $image,
    });
  }

  override async close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string> {
    await this.insertStatement.finalize();
    await this.selectStatement.finalize();
    /*
     * `exec` rather than `run`: this is two statements, and sqlite3's `run`
     * prepares only the first — the INSERT never used to happen, leaving
     * `info` empty.
     */
    await this.db.exec(
      `DELETE FROM info;
       INSERT INTO info(minzoom, maxzoom) VALUES((SELECT MIN(z) FROM tiles), (SELECT MAX(z) FROM tiles));`,
    );
    return this.closeDatabase('BCNav', routeAttribution, tileAttribution);
  }
}
