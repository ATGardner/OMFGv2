import type {FeatureCollection, Geometry} from 'geojson';
import type Tile from './utils/Tile.ts';

/*
 * The three roles a download is assembled from. They lived only as an implicit
 * contract before — `DownloadJob` calls these methods on whatever the three
 * `get*` factories hand back, and nothing said so. Written down here, adding a
 * source or a packager is checked against the job that will drive it.
 */

export interface RouteSource {
  readonly id: string;

  /*
   * Optional because a local file has no canonical attribution unless the
   * caller passes `--routeAttribution`; an OSM relation always has one.
   */
  readonly routeAttribution?: string;

  /*
   * Nullable geometry: `@tmcw/togeojson` maps a KML Placemark with no shape to
   * a feature with `geometry: null`, and `extractCoordinates` skips those.
   */
  getGeoJson(): Promise<FeatureCollection<Geometry | null>>;
}

export interface TileSource {
  readonly id: string;

  /*
   * `Address` and `attribution` come from sources.json and so only exist on
   * the WMTS sources. `MBTilesPackager` writes both into its metadata table
   * and has always had to cope with their absence for the FS/MB/Maperitive
   * sources — now the type says so.
   */
  readonly Address?: string;

  readonly attribution?: string;

  init(): void | Promise<void>;

  getTileData(tile: Tile): Buffer | undefined | Promise<Buffer | undefined>;

  /*
   * Maperitive only: it shells out to a Windows binary that renders every
   * requested tile in one batch, so `getTileData` parks each caller until this
   * runs. `DownloadJob` calls it if it is there.
   */
  generateAllTiles?(): void | Promise<void>;

  close?(): Promise<void>;
}

export interface Packager {
  readonly id: string;

  /*
   * One name per file written — an array only for `MultiPackager`, which
   * fronts several.
   */
  readonly fileName: string | string[];

  init(source: TileSource): Promise<void>;

  hasTile(tile: Tile): Promise<boolean>;

  addTile(tile: Tile, data: Buffer): Promise<void>;

  /*
   * Resolves to the file written, or to one name per packager for
   * `MultiPackager`.
   */
  close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string | string[]>;
}

/*
 * One entry of src/tileSources/sources.json. `compress` selects `JPEGSource`
 * over a plain `WMTSSource`; `quality` is the JPEG quality that source is
 * re-encoded at, defaulting to 50 when the entry omits it.
 */
export interface SourceDescriptor {
  Name: string;
  Address: string;
  minZoom: number;
  maxZoom: number;
  attribution: string;
  type: string;
  compress?: boolean;
  quality?: number;
}

export interface JobState {
  status: string;
  result?: unknown;
  code?: number;
}
