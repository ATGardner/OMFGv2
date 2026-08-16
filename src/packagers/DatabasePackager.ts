import {EOL} from 'os';
import type {Packager} from '../types.ts';
import {ensurePath, zip} from '../utils/index.ts';
import Database from '../utils/sqlite3-async.ts';
import type Tile from '../utils/Tile.ts';

const COPYRIGHT = `Created using OMFG (https://github.com/ATGardner/OMFGv2)${EOL}`;

export default abstract class DatabasePackager implements Packager {
  readonly fileName: string;

  /*
   * A file that did not exist before this run cannot already hold a tile, so
   * the subclasses skip their `hasTile` query entirely when this is set.
   */
  protected readonly newFile: boolean;

  protected readonly db: Database;

  constructor(fileName: string) {
    this.fileName = fileName;
    this.newFile = !ensurePath(fileName);
    this.db = new Database(fileName);
  }

  get id(): string {
    return `DB_${this.fileName}`;
  }

  /*
   * Takes no argument, though `Packager.init` is handed the tile source: only
   * `MBTilesPackager` reads it, to copy the source's attribution and image
   * format into its metadata table. A method declaring fewer parameters still
   * satisfies the interface.
   */
  init(): Promise<void> {
    return this.db.init();
  }

  abstract hasTile(tile: Tile): Promise<boolean>;

  abstract addTile(tile: Tile, data: Uint8Array): Promise<void>;

  /*
   * The subclasses own the public two-argument `close` and call this with the
   * name of the format they wrote. It used to be `close` itself, taking
   * `type` ahead of the same two arguments, so the base class and its
   * subclasses disagreed about what `close` means — the subclasses relayed
   * `super.close('Orux', ...args)` and any caller holding a `DatabasePackager`
   * got the wrong signature.
   */
  protected async closeDatabase(
    type: string,
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string> {
    await this.db.close();
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
