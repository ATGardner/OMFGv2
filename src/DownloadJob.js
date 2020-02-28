import {getLogger} from './utils/logging.js';
import {
  coordinates2Tiles,
  extractCoordinates,
  generateId,
} from './utils/index.js';

const logger = getLogger('downloadJob');

function* extractUniqueTileDefinitions(json, minZoom, maxZoom) {
  const tileIds = new Set();
  const coordinates = extractCoordinates(json);
  for (const coordinate of coordinates) {
    let tiles = coordinates2Tiles(coordinate, maxZoom, 3000);
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
  #total;
  #done;
  #failed;
  #t0;

  constructor(total) {
    this.#total = total;
    this.#done = 0;
    this.#failed = 0;
    this.#t0 = new Date().getTime();
  }

  get completed() {
    return this.#done + this.#failed;
  }

  get percent() {
    return Math.floor((100 * this.completed) / this.#total);
  }

  get estimate() {
    const t1 = new Date().getTime();
    const ty = t1 - this.#t0;
    const msPerCount = ty / this.completed;
    const remaining = this.#total - this.completed;
    return msPerCount * remaining;
  }

  incrementDone() {
    this.#done += 1;
  }

  incrementFailed() {
    this.#failed += 1;
  }

  toString() {
    return `Done ${this.percent}% ${this.#done}/${this.#total} [${this.#failed} failed]`;
  }
}

export default class DownloadJob {
  #id;
  #routeSource;
  #packager;
  #minZoom;
  #maxZoom;
  #state;

  constructor(routeSource, tileSource, packager, minZoom, maxZoom) {
    this.#id = generateId(
      routeSource.id,
      tileSource.id,
      packager.id,
      minZoom,
      maxZoom,
    );
    this.#routeSource = routeSource;
    this.#tileSource = tileSource;
    this.#packager = packager;
    this.#minZoom = minZoom;
    this.#maxZoom = maxZoom;
    this.#state = {status: 'N/A'};
  }

  get id() {
    return this.#id;
  }

  get state() {
    if (this.counters) {
      this.#state.result = this.counters.estimate;
    }

    return this.#state;
  }

  async start() {
    try {
      this.#state.status = 'Pending';
      const geoJson = await this.#routeSource.getGeoJson();
      const tileDefinitions = [
        ...extractUniqueTileDefinitions(geoJson, this.#minZoom, this.#maxZoom),
      ];
      const total = tileDefinitions.length;
      this.#counters = new Counters(total);
      logger.verbose(`Downloading ${total} tiles`);
      let percent = 0;
      const promises = [];
      await this.#tileSource.init();
      await this.#packager.init(this.#tileSource);
      for (const td of tileDefinitions) {
        const tilePromise = (async () => {
          try {
            const hasData = await this.#packager.hasTile(td);
            if (hasData) {
              this.counters.incrementDone();
              // logger.verbose(`Packager has tile ${td.toString()}`);
              return;
            }

            const data = await this.#tileSource.getTileData(td);
            if (data) {
              await this.#packager.addTile(td, data);
              this.#counters.incrementDone();
            } else {
              this.#counters.incrementFailed();
            }
          } catch (error) {
            logger.error(`Failed getting tile ${td.toString()}`, error.message);
            this.#counters.incrementFailed();
          } finally {
            const newPercent = this.#counters.percent;
            if (newPercent > percent) {
              percent = newPercent;
              logger.verbose(this.#counters.toString());
            }
          }
        })();
        promises.push(tilePromise);
      }

      if (this.#tileSource.generateAllTiles) {
        this.#tileSource.generateAllTiles();
      }

      await Promise.all(promises);
      this.counters = undefined;
      this.#state.result = await this.#packager.close(
        this.#routeSource.routeAttribution,
        this.#tileSource.attribution,
      );
      this.#state.status = 'Done';
    } catch (error) {
      this.#state.result = error;
      this.#state.status = 'Failed';
      throw error;
    }
  }
}
