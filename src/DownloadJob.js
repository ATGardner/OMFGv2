const winston = require('winston');
const {coordinates2Tiles, extractCoordinates, generateId} = require('./utils');

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
  constructor(total) {
    this._total = total;
    this._done = 0;
    this._failed = 0;
  }

  get percent() {
    return Math.floor(100 * (this._done + this._failed) / this._total);
  }

  incrementDone() {
    this._done += 1;
  }

  incrementFailed() {
    this._failed += 1;
  }

  toString() {
    return `Done ${this.percent}% ${this._done}/${this._total} [${
      this._failed
    } failed]`;
  }
}
class DownloadJob {
  constructor(routeSource, tileSource, packager, minZoom, maxZoom) {
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
    this.state = {status: 'N/A'};
  }

  start() {
    this.promise = this.getTiles();
  }

  async getTiles() {
    try {
      this.state.status = 'Pending';
      const geoJson = await this.routeSource.getGeoJson();
      const tileDefinitions = [
        ...extractUniqueTileDefinitions(geoJson, this.minZoom, this.maxZoom),
      ];
      const total = tileDefinitions.length;
      const counters = new Counters(total);
      winston.verbose(`Downloading ${total} tiles`);
      this.state.done = 0;
      this.state.failed = 0;
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
              // winston.verbose(`Packager has tile ${td.toString()}`);
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
            winston.error(
              `Failed getting tile ${td.toString()}`,
              error.message,
            );
            counters.incrementFailed();
          } finally {
            const newPercent = counters.percent;
            if (newPercent > percent) {
              percent = newPercent;
              winston.verbose(counters.toString());
            }
          }
        })();
        promises.push(tilePromise);
      }

      if (this.tileSource.generateAllTiles) {
        this.tileSource.generateAllTiles();
      }

      await Promise.all(promises);
      this.result = await this.packager.close(
        this.routeSource.routeAttribution,
        this.tileSource.attribution,
      );
      this.state.status = 'Done';
    } catch (error) {
      this.state.result = error;
      this.state.status = 'Failed';
      throw error;
    }
  }
}

module.exports = DownloadJob;
