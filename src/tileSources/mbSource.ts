import {DatabaseSync, type StatementSync} from 'node:sqlite';
import {basename, extname} from 'path';
import type {TileSource} from '../types.ts';
import type Tile from '../utils/Tile.ts';

export default class MBSource implements TileSource {
  readonly Name: string;

  private readonly db: DatabaseSync;

  private selectStatement!: StatementSync;

  constructor(fileName: string) {
    this.db = new DatabaseSync(fileName, {readOnly: true});
    const ext = extname(fileName);
    this.Name = basename(fileName, ext);
  }

  get id(): string {
    return `MB_${this.Name}`;
  }

  init(): void {
    this.selectStatement = this.db.prepare(
      'SELECT tile_data FROM tiles WHERE tile_column = $tile_column AND tile_row = $tile_row AND zoom_level = $zoom_level;',
    );
  }

  getTileData(tile: Tile): Uint8Array | undefined {
    const $tile_row = (1 << tile.zoom) - tile.y - 1;
    const row = this.selectStatement.get({
      $tile_column: tile.x,
      $tile_row,
      $zoom_level: tile.zoom,
    });
    return row?.tile_data as Uint8Array | undefined;
  }

  close(): void {
    this.db.close();
  }
}
