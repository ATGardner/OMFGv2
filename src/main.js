const {readGeoJson, extractCoordinates, coordinates2Tile, getTileData} = require('./utils');

function* readInputFiles(inputFiles) {
  for (const input of inputFiles) {
    yield readGeoJson(input);
  }
}

function* extractUniqueTileDefinitions(coordinates, minZoom, maxZoom) {
  const tiles = new Set();
  for (const coordinate of coordinates) {
    let tile = coordinates2Tile(coordinate, maxZoom);
    while (!tiles.has(tile.toString()) && tile.zoom >= minZoom) {
      tiles.add(tile.toString());
      yield tile;
      tile = tile.parentTile;
    }
  }
}

async function downloadTiles(inputFiles, source, minZoom, maxZoom, output) {
  for (const inputFile of inputFiles) {
    const json = readGeoJson(inputFile);
    const coordinates = extractCoordinates(json);
    const tileDefinitions = extractUniqueTileDefinitions(coordinates, minZoom, maxZoom);
    for (const td of tileDefinitions) {
      const data = await getTileData(source, td);
      console.log(data.length);
    }
  }
}

module.exports = {
  downloadTiles
};
