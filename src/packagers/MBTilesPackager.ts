import type {StatementSync} from 'node:sqlite';
import {basename, extname, format} from 'path';
import type {TileSource} from '../types.ts';
import type Tile from '../utils/Tile.ts';
import DatabasePackager from './DatabasePackager.ts';

export default class MBTilesPackager extends DatabasePackager {
  private metadataStatement!: StatementSync;

  private insertStatement!: StatementSync;

  private selectStatement!: StatementSync;

  constructor(fileName: string) {
    super(format({name: fileName, ext: '.mbtiles'}));
  }

  override get id(): string {
    return `MBTiles_${super.id}`;
  }

  override init(source?: TileSource): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS tiles (tile_column integer, tile_row integer, zoom_level integer, tile_data blob, PRIMARY KEY (tile_column, tile_row, zoom_level));',
    );
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS IND on tiles (tile_column, tile_row, zoom_level);',
    );
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS metadata (name text, value text, PRIMARY KEY (name));',
    );
    this.metadataStatement = this.db.prepare(
      'INSERT or REPLACE INTO metadata(name, value) VALUES($name, $value);',
    );
    this.insertStatement = this.db.prepare(
      'INSERT or REPLACE INTO tiles (tile_column, tile_row, zoom_level, tile_data) VALUES ($tile_column, $tile_row, $zoom_level, $tile_data);',
    );
    this.selectStatement = this.db.prepare(
      'SELECT COUNT(*) AS result FROM tiles WHERE tile_column = $tile_column AND tile_row = $tile_row and zoom_level = $zoom_level;',
    );
    const name = basename(this.fileName);
    this.setMetadata('name', name);
    this.setMetadata('type', 'baselayer');
    /*
     * A string, not `1`: node:sqlite binds a JS number as a double, and this
     * column's TEXT affinity then renders it `"1.0"` where the `sqlite3`
     * package — which bound integral numbers as integers — wrote `"1"`.
     */
    this.setMetadata('version', '1');
    this.setMetadata('description', name);
    /*
     * Only the WMTS sources carry an `Address` to read an extension off — an
     * FS or MBTiles source has none, and writes no `format` rather than
     * throwing on `extname(undefined)`.
     */
    if (source?.Address) {
      this.setMetadata('format', extname(source.Address).slice(1));
    }

    this.setMetadata('attribution', source?.attribution);
    this.setMetadata('locale', 'en-US');
  }

  override hasTile({x, y, zoom}: Tile): boolean {
    if (this.newFile) {
      return false;
    }

    const $tile_row = (1 << zoom) - y - 1;
    const row = this.selectStatement.get({
      $tile_column: x,
      $tile_row,
      $zoom_level: zoom,
    });
    return row?.result === 1;
  }

  override addTile({x, y, zoom}: Tile, $tile_data: Uint8Array): void {
    const $tile_row = (1 << zoom) - y - 1;
    this.batch.write(() => {
      this.insertStatement.run({
        $tile_column: x,
        $tile_row,
        $zoom_level: zoom,
        $tile_data,
      });
    });
  }

  setMetadata($name: string, $value?: string): void {
    this.batch.write(() => {
      this.metadataStatement.run({
        $name,
        // Null binds; undefined is rejected by the driver
        $value: $value ?? null,
      });
    });
  }

  override close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string> {
    return this.closeDatabase('Orux', routeAttribution, tileAttribution);
  }
}
