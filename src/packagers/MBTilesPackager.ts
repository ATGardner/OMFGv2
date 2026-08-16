import {basename, extname, format} from 'path';
import type {TileSource} from '../types.ts';
import type {Statement} from '../utils/sqlite3-async.ts';
import type Tile from '../utils/Tile.ts';
import DatabasePackager from './DatabasePackager.ts';

interface CountRow {
  result: number;
}

export default class MBTilesPackager extends DatabasePackager {
  private metadataStatement!: Statement;

  private insertStatement!: Statement;

  private selectStatement!: Statement;

  constructor(fileName: string) {
    super(format({name: fileName, ext: '.mbtiles'}));
  }

  override get id(): string {
    return `MBTiles_${super.id}`;
  }

  override async init(source?: TileSource): Promise<void> {
    await super.init();
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS tiles (tile_column integer, tile_row integer, zoom_level integer, tile_data blob, PRIMARY KEY (tile_column, tile_row, zoom_level));',
    );
    await this.db.run(
      'CREATE INDEX IF NOT EXISTS IND on tiles (tile_column, tile_row, zoom_level);',
    );
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS metadata (name text, value text, PRIMARY KEY (name));',
    );
    this.metadataStatement = await this.db.prepare(
      'INSERT or REPLACE INTO metadata(name, value) VALUES($name, $value);',
    );
    this.insertStatement = await this.db.prepare(
      'INSERT or REPLACE INTO tiles (tile_column, tile_row, zoom_level, tile_data) VALUES ($tile_column, $tile_row, $zoom_level, $tile_data);',
    );
    this.selectStatement = await this.db.prepare(
      'SELECT COUNT(*) AS result FROM tiles WHERE tile_column = $tile_column AND tile_row = $tile_row and zoom_level = $zoom_level;',
    );
    const name = basename(this.fileName);
    await this.setMetadata('name', name);
    await this.setMetadata('type', 'baselayer');
    /*
     * A string, not `1`: node:sqlite binds a JS number as a double, and this
     * column's TEXT affinity then renders it `"1.0"` where the `sqlite3`
     * package — which bound integral numbers as integers — wrote `"1"`.
     */
    await this.setMetadata('version', '1');
    await this.setMetadata('description', name);
    /*
     * Only the WMTS sources carry an `Address` to read an extension off — an
     * FS or MBTiles source has none, and writes no `format` rather than
     * throwing on `extname(undefined)`.
     */
    if (source?.Address) {
      await this.setMetadata('format', extname(source.Address).slice(1));
    }

    await this.setMetadata('attribution', source?.attribution);
    await this.setMetadata('locale', 'en-US');
  }

  override async hasTile({x, y, zoom}: Tile): Promise<boolean> {
    if (this.newFile) {
      return false;
    }

    const $tile_row = (1 << zoom) - y - 1;
    const row = await this.selectStatement.get<CountRow>({
      $tile_column: x,
      $tile_row,
      $zoom_level: zoom,
    });
    return row?.result === 1;
  }

  override addTile({x, y, zoom}: Tile, $tile_data: Uint8Array): Promise<void> {
    const $tile_row = (1 << zoom) - y - 1;
    return this.insertStatement.run({
      $tile_column: x,
      $tile_row,
      $zoom_level: zoom,
      $tile_data,
    });
  }

  setMetadata($name: string, $value?: string): Promise<void> {
    return this.metadataStatement.run({
      $name,
      $value,
    });
  }

  override async close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string> {
    await this.insertStatement.finalize();
    await this.selectStatement.finalize();
    await this.metadataStatement.finalize();
    return this.closeDatabase('Orux', routeAttribution, tileAttribution);
  }
}
