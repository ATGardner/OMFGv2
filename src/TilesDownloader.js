const EventEmitter = require('events');
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
    const tileDefinitions = extractUniqueTileDefinitions(
      geoJson,
      this.minZoom,
      this.maxZoom,
    );
    const promises = [];
    await this.tileSource.init();
    await this.packager.init();
    for (const td of tileDefinitions) {
      const tilePromise = (async () => {
        try {
          const hasData = await this.packager.hasTile(td);
          if (hasData) {
            return;
          }

          const data = await this.tileSource.getTileData(td);
          if (data) {
            await this.packager.addTile(td, data);
          }
        } catch (error) {
          throw error;
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
