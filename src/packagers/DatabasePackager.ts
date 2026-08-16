import {DatabaseSync} from 'node:sqlite';
import {EOL} from 'os';
import type {Packager, TileSource} from '../types.ts';
import {ensurePath, zip} from '../utils/index.ts';
import type Tile from '../utils/Tile.ts';
import WriteBatch from '../utils/WriteBatch.ts';

const COPYRIGHT = `Created using OMFG (https://github.com/ATGardner/OMFGv2)${EOL}`;

export default abstract class DatabasePackager implements Packager {
  readonly fileName: string;

  /*
   * A file that did not exist before this run cannot already hold a tile, so
   * the subclasses skip their `hasTile` query entirely when this is set.
   */
  protected readonly newFile: boolean;

  protected readonly db: DatabaseSync;

  protected readonly batch: WriteBatch;

  constructor(fileName: string) {
    this.fileName = fileName;
    this.newFile = !ensurePath(fileName);
    this.db = new DatabaseSync(fileName);
    this.batch = new WriteBatch(this.db);
  }

  get id(): string {
    return `DB_${this.fileName}`;
  }

  /*
   * `source` is only read by `MBTilesPackager`, which copies the tile source's
   * attribution and image format into its metadata table.
   */
  abstract init(source?: TileSource): void;

  abstract hasTile(tile: Tile): boolean;

  abstract addTile(tile: Tile, data: Uint8Array): void;

  /*
   * The subclasses own the public two-argument `close` and call this with the
   * name of the format they wrote. It used to be `close` itself, taking
   * `type` ahead of the same two arguments, so the base class and its
   * subclasses disagreed about what `close` means.
   *
   * Still async, and the last part of the pipeline that is: `zip` is genuinely
   * asynchronous, where every database call above it is not.
   */
  protected async closeDatabase(
    type: string,
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string> {
    this.batch.flush();
    this.db.close();
    const tiles = tileAttribution
      ? `Tiles Source: ${tileAttribution}${EOL}`
      : '';
    const route = routeAttribution
      ? `Route Source: ${routeAttribution}${EOL}`
      : '';
    const createdAt = `${new Date().toISOString()}${EOL}`;
    const copyright = `${COPYRIGHT}${tiles}${route}${createdAt}`;
    return zip(this.fileName, copyright, type);
  }

  abstract close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string>;
}
