import {existsSync, readFileSync} from 'fs';
import {join} from 'path';
import type {TileSource} from '../types.ts';
import type Tile from '../utils/Tile.ts';

export default class FSSource implements TileSource {
  protected readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  get id(): string {
    return `FS_${this.basePath}`;
  }

  init(): void {
    // Do nothing
  }

  /*
   * Split out from `getTileData` for `MaperitiveSource`, which reads the disk
   * twice around an await and so cannot go through its own async override.
   */
  protected readTile(tile: Tile): Buffer | undefined {
    const path = join(
      this.basePath,
      `${tile.zoom}`,
      `${tile.x}`,
      `${tile.y}.png`,
    );
    return existsSync(path) ? readFileSync(path) : undefined;
  }

  getTileData(tile: Tile): Buffer | undefined | Promise<Buffer | undefined> {
    return this.readTile(tile);
  }
}
