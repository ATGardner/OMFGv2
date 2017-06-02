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
  await packager.init();
  for (const td of tileDefinitions) {
    const tilePromise = (async () => {
      console.log(`Start handling ${td.toString()}`);
      const data = await source.getTileData(td);
      await packager.addTile(td, data);
      console.log(`Done handling ${td.toString()}`);
    })();
    promises.push(tilePromise);
  }

  await Promise.all(promises);
  await packager.close();
  console.log('done');
}

module.exports = {
  downloadTiles
};
