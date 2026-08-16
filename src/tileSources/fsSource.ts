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
   * Synchronous, and typed as such: reading a tile off the local disk has
   * nothing to await. The interface allows a promise for the sources that
   * fetch over the network, and `DownloadJob` awaits the result either way.
   *
   * This used to delegate to a `protected readTile`, split out for
   * `MaperitiveSource` — which read the disk twice around an await and so
   * could not go through its own async override. That source is gone, and
   * with it the only caller of the seam.
   */
  getTileData(tile: Tile): Uint8Array | undefined {
    const path = join(
      this.basePath,
      `${tile.zoom}`,
      `${tile.x}`,
      `${tile.y}.png`,
    );
    return existsSync(path) ? readFileSync(path) : undefined;
  }
}
