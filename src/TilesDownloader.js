const EventEmitter = require('events');
const winston = require('winston');
const {extractCoordinates, coordinates2Tiles} = require('./utils');

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

class TilesDownloader extends EventEmitter {
  constructor(geoSource, tileSource, packager, minZoom, maxZoom) {
    super();
    this.geoSource = geoSource;
    this.tileSource = tileSource;
    this.packager = packager;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  async getTiles() {
    const geoJson = await this.geoSource.getGeoJson();
    const tileDefinitions = [
      ...extractUniqueTileDefinitions(geoJson, this.minZoom, this.maxZoom),
    ];

    const total = tileDefinitions.length;
    winston.verbose(`Downloading ${total} tiles`);
    let done = 0;
    let failed = 0;
    let percent = 0;
    const promises = [];
    await this.tileSource.init();
    await this.packager.init(this.tileSource);
    for (const td of tileDefinitions) {
      const tilePromise = (async () => {
        try {
          const hasData = await this.packager.hasTile(td);
          if (hasData) {
            done += 1;
            // winston.verbose(`Packager has tile ${td.toString()}`);
            return;
          }

          const data = await this.tileSource.getTileData(td);
          if (data) {
            await this.packager.addTile(td, data);
            done += 1;
          } else {
            failed += 1;
          }
        } catch (error) {
          winston.error(
            `Failed getting tile ${td.toString()}`,
            error.message,
          );
          failed += 1;
        } finally {
          const newPercent = Math.floor(100 * (done + failed) / total);
          if (newPercent > percent) {
            percent = newPercent;
            winston.verbose(
              `Done ${percent}% ${done}/${total} [${failed} failed]`,
            );
          }
        }
      })();
      promises.push(tilePromise);
    }

    if (this.tileSource.generateAllTiles) {
      this.tileSource.generateAllTiles();
    }

    await Promise.all(promises);
    await this.packager.close();
  }
}

module.exports = TilesDownloader;
