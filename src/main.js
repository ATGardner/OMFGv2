const winston = require('winston');
const { readGeoJson, extractCoordinates, coordinates2Tiles } = require('./utils');

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

async function downloadTiles(inputFiles, source, minZoom, maxZoom, packager) {
  const coordinates = extractAllCoordinates(inputFiles);
  const tileDefinitions = extractUniqueTileDefinitions(coordinates, minZoom, maxZoom);
  const promises = [];
  await source.init();
  await packager.init();
  let total = 0;
  let success = 0;
  let failure = 0;
  let inProgressTiles = new Set();
  for (const td of tileDefinitions) {
    const tilePromise = (async () => {
      try {
        total += 1;
        inProgressTiles.add(td.toString());
        winston.verbose(`Start handling ${td.toString()}, ${success}/${total} (${inProgressTiles.size})`);
        const data = await source.getTileData(td);
        if (data) {
          await packager.addTile(td, data);
          success += 1;
          winston.verbose(
            `Done handling ${td.toString()}, ${success}/${failure}/${success +
              failure}/${total} (${inProgressTiles.size})`,
          );
        } else {
          failure += 1;
          winston.warn(
            `Failed handling ${td.toString()}, ${success}/${failure}/${success +
              failure}/${total} (${inProgressTiles.size})`,
          );
        }

        inProgressTiles.delete(td.toString());
      } catch (error) {
        winston.error(`Error on tile ${td.toString}`, error);
        inProgressTiles.delete(td.toString());
        throw error;
      }
    })();
    promises.push(tilePromise);
  }

  if (source.generateAllTiles) {
    source.generateAllTiles();
  }

  try {
    let interval = setInterval(() => {
      winston.verbose(`inProgressTiles: ${[...inProgressTiles]}`);
    }, 20000);
    await Promise.all(promises);
    clearInterval(interval);
    await packager.close();
    winston.verbose(`Finished getting ${success}/${total} tiles`);
  } catch (error) {
    winston.error('Error on wait all', error);
  }
}

module.exports = {
  downloadTiles,
};
