import {basename, extname} from 'path';
import type {TileSource} from '../types.ts';
import Database, {type Statement} from '../utils/sqlite3-async.ts';
import type Tile from '../utils/Tile.ts';

interface TileRow {
  tile_data: Uint8Array;
}

export default class MBSource implements TileSource {
  readonly Name: string;

  private readonly db: Database;

  private selectStatement!: Statement;

  constructor(fileName: string) {
    this.db = new Database(fileName, {readOnly: true});
    const ext = extname(fileName);
    this.Name = basename(fileName, ext);
  }

  get id(): string {
    return `MB_${this.Name}`;
  }

  async init(): Promise<void> {
    await this.db.init();
    this.selectStatement = await this.db.prepare(
      'SELECT tile_data FROM tiles WHERE tile_column = $tile_column AND tile_row = $tile_row AND zoom_level = $zoom_level;',
    );
  }

  async getTileData(tile: Tile): Promise<Uint8Array | undefined> {
    const $tile_row = (1 << tile.zoom) - tile.y - 1;
    const row = await this.selectStatement.get<TileRow>({
      $tile_column: tile.x,
      $tile_row,
      $zoom_level: tile.zoom,
    });
    return row?.tile_data;
  }
}
