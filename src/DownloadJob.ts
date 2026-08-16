import type {FeatureCollection, Geometry} from 'geojson';
import type {JobState, Packager, RouteSource, TileSource} from './types.ts';
import {
  coordinates2Tiles,
  extractCoordinates,
  generateId,
} from './utils/index.ts';
import {getLogger} from './utils/logging.ts';
import type Tile from './utils/Tile.ts';

const logger = getLogger('downloadJob');

function* extractUniqueTileDefinitions(
  json: FeatureCollection<Geometry | null>,
  minZoom: number,
  maxZoom: number,
): Generator<Tile> {
  const tileIds = new Set<string>();
  const coordinates = extractCoordinates(json);
  for (const coordinate of coordinates) {
    const tiles = coordinates2Tiles(coordinate, maxZoom, 3000);
    for (let tile of tiles) {
      let tileId = tile.toString();
      while (!tileIds.has(tileId) && tile.zoom >= minZoom) {
        tileIds.add(tileId);
        yield tile;
        tile = tile.parentTile;
        tileId = tile.toString();
      }
    }
  }
}

class Counters {
  private readonly total: number;

  private done = 0;

  private failed = 0;

  private readonly t0 = new Date().getTime();

  constructor(total: number) {
    this.total = total;
  }

  get completed(): number {
    return this.done + this.failed;
  }

  get percent(): number {
    return Math.floor((100 * this.completed) / this.total);
  }

  /*
   * Milliseconds still to go, extrapolated from the rate so far.
   */
  get estimate(): number {
    const t1 = new Date().getTime();
    const ty = t1 - this.t0;
    const msPerCount = ty / this.completed;
    const remaining = this.total - this.completed;
    return msPerCount * remaining;
  }

  incrementDone(): void {
    this.done += 1;
  }

  incrementFailed(): void {
    this.failed += 1;
  }

  toString(): string {
    return `Done ${this.percent}% ${this.done}/${this.total} [${this.failed} failed]`;
  }
}

export default class DownloadJob {
  readonly id: string;

  /*
   * Set by `DownloadManager` once the job is queued, so `awaitDownload` has
   * something to hand back. It used to be read there and never written, which
   * made awaiting a job resolve with `undefined` instead of its result.
   */
  promise?: Promise<void>;

  private readonly routeSource: RouteSource;

  private readonly tileSource: TileSource;

  private readonly packager: Packager;

  private readonly minZoom: number;

  private readonly maxZoom: number;

  private readonly _state: JobState = {status: 'N/A'};

  private counters?: Counters;

  constructor(
    routeSource: RouteSource,
    tileSource: TileSource,
    packager: Packager,
    minZoom: number,
    maxZoom: number,
  ) {
    this.id = generateId(
      routeSource.id,
      tileSource.id,
      packager.id,
      minZoom,
      maxZoom,
    );
    this.routeSource = routeSource;
    this.tileSource = tileSource;
    this.packager = packager;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  get state(): JobState {
    if (this.counters) {
      this._state.result = this.counters.estimate;
    }

    return this._state;
  }

  async start(): Promise<void> {
    try {
      this.state.status = 'Pending';
      const geoJson = await this.routeSource.getGeoJson();
      const tileDefinitions = [
        ...extractUniqueTileDefinitions(geoJson, this.minZoom, this.maxZoom),
      ];
      const total = tileDefinitions.length;
      const counters = new Counters(total);
      this.counters = counters;
      logger.verbose(`Downloading ${total} tiles`);
      let percent = 0;
      const promises = [];
      await this.tileSource.init();
      await this.packager.init(this.tileSource);
      for (const td of tileDefinitions) {
        const tilePromise = (async () => {
          try {
            const hasData = await this.packager.hasTile(td);
            if (hasData) {
              counters.incrementDone();
              return;
            }

            const data = await this.tileSource.getTileData(td);
            if (data) {
              await this.packager.addTile(td, data);
              counters.incrementDone();
            } else {
              counters.incrementFailed();
            }
          } catch (error) {
            logger.error(
              `Failed getting tile ${td.toString()}`,
              error instanceof Error ? error.message : error,
            );
            counters.incrementFailed();
          } finally {
            const newPercent = counters.percent;
            if (newPercent > percent) {
              percent = newPercent;
              logger.verbose(counters.toString());
            }
          }
        })();
        promises.push(tilePromise);
      }

      if (this.tileSource.generateAllTiles) {
        await this.tileSource.generateAllTiles();
      }

      await Promise.all(promises);
      this.counters = undefined;
      this.state.result = await this.packager.close(
        this.routeSource.routeAttribution,
        this.tileSource.attribution,
      );
      this.state.status = 'Done';
    } catch (error) {
      /*
       * Both of these used to assign `result`, so a failed job reported the
       * string 'Failed' as its result and kept whatever status it had reached.
       */
      this.state.result = error;
      this.state.status = 'Failed';
      throw error;
    }
  }
}
