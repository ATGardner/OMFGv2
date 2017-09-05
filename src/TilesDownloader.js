const EventEmitter = require('events');
const {readGeoJson, extractCoordinates, coordinates2Tiles} = require('./utils');

function* extractUniqueTileDefinitions(coordinates, minZoom, maxZoom) {
  const ids = new Set();
  for (const coordinate of coordinates) {
    let tiles = coordinates2Tiles(coordinate, maxZoom, 3000);
    for (let tile of tiles) {
      let tileId = tile.toString();
      while (!ids.has(tileId) && tile.zoom >= minZoom) {
        ids.add(tileId);
        yield tile;
        tile = tile.parentTile;
        tileId = tile.toString();
      }
    }
  }
}

function* extractAllCoordinates(inputFiles) {
  for (const input of inputFiles) {
    const json = readGeoJson(input);
    yield* extractCoordinates(json);
  }
}

class TilesDownloader extends EventEmitter {
  constructor(inputFiles, source, packager, minZoom, maxZoom) {
    super();
    this.inputFiles = inputFiles;
    this.source = source;
    this.packager = packager;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  async getTiles() {
    const coordinates = extractAllCoordinates(this.inputFiles);
    const tileDefinitions = extractUniqueTileDefinitions(
      coordinates,
      this.minZoom,
      this.maxZoom,
    );
    const promises = [];
    await this.source.init();
    await this.packager.init();
    for (const td of tileDefinitions) {
      const tilePromise = (async () => {
        try {
          const hasData = await this.packager.hasTile(td);
          if (hasData) {
            return;
          }

          const data = await this.source.getTileData(td);
          if (data) {
            await this.packager.addTile(td, data);
          }
        } catch (error) {
          throw error;
        }
      })();
      promises.push(tilePromise);
    }

    if (this.source.generateAllTiles) {
      this.source.generateAllTiles();
    }

    await Promise.all(promises);
    await this.packager.close();
  }
}

module.exports = TilesDownloader;
