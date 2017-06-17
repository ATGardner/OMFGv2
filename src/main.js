const winston = require('winston');
const { readGeoJson, extractCoordinates, coordinates2Tile } = require('./utils');

function* extractUniqueTileDefinitions(coordinates, minZoom, maxZoom) {
  const tiles = new Set();
  for (const coordinate of coordinates) {
    let tile = coordinates2Tile(coordinate, maxZoom);
    let tileId = tile.toString();
    while (!tiles.has(tileId) && tile.zoom >= minZoom) {
      tiles.add(tileId);
      yield tile;
      tile = tile.parentTile;
      tileId = tile.toString();
    }
  }
}

function* extractAllCoordinates(inputFiles) {
  for (const input of inputFiles) {
    const json = readGeoJson(input);
    yield* extractCoordinates(json);
  }
}

async function downloadTiles(inputFiles, source, minZoom, maxZoom, packager) {
  const coordinates = extractAllCoordinates(inputFiles);
  const tileDefinitions = extractUniqueTileDefinitions(coordinates, minZoom, maxZoom);
  const promises = [];
  await source.init();
  await packager.init();
  let total = 0;
  let success = 0;
  for (const td of tileDefinitions) {
    const tilePromise = (async () => {
      total += 1;
      winston.verbose(`Start handling ${td.toString()}, ${success}/${total}`);
      const data = await source.getTileData(td);
      if (data) {
        await packager.addTile(td, data);
        success += 1;
        winston.verbose(`Done handling ${td.toString()}, ${success}/${total}`);
      } else {
        winston.warn(`Failed handling ${td.toString()}, ${success}/${total}`);
      }
    })();
    promises.push(tilePromise);
  }

  source.generateAllTiles();
  await Promise.all(promises);
  await packager.close();
  winston.verbose(`Finished getting ${success}/${total} tiles`);
}

module.exports = {
  downloadTiles
};
