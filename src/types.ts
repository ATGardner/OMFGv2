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
   * and has always had to cope with their absence for the FS and MB sources —
   * now the type says so.
   */
  readonly Address?: string;

  readonly attribution?: string;

  init(): void | Promise<void>;

  getTileData(
    tile: Tile,
  ): Uint8Array | undefined | Promise<Uint8Array | undefined>;

  close?(): void | Promise<void>;
}

export interface Packager {
  readonly id: string;

  /*
   * One name per file written — an array only for `MultiPackager`, which
   * fronts several.
   */
  readonly fileName: string | string[];

  /*
   * Synchronous, all three: node:sqlite has no asynchronous API, so a promise
   * here would only wrap an already-finished write.
   */
  init(source: TileSource): void;

  hasTile(tile: Tile): boolean;

  addTile(tile: Tile, data: Uint8Array): void;

  /*
   * The exception, because `zip` really is asynchronous. Resolves to the file
   * written, or to one name per packager for `MultiPackager`.
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

  /*
   * Epoch milliseconds, written once the job reaches Done or Failed. Absent
   * for as long as it runs, which is the whole of what keeps retention from
   * collecting a job that is still writing its output — a live job simply
   * fails the comparison, with no special case for it anywhere.
   */
  finishedAt?: number;
}
