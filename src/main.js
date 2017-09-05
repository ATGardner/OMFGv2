const {extname, basename, join} = require('path');
const winston = require('winston');
const {getPackager} = require('./packagers');
const {getSource} = require('./sources');
const TilesDownloader = require('./TilesDownloader');

winston.level = 'verbose';

/* async function downloadTiles(inputFiles, source, minZoom, maxZoom, packager) {
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
        winston.verbose(
          `Start handling ${td.toString()}, ${success}/${failure}/${success +
          failure}/${total} (${inProgressTiles.size})`,
        );
        const hasData = await packager.hasTile(td);
        if (hasData) {
          success += 1;
          winston.verbose(
            `Skipped handling ${td.toString()}, ${success}/${failure}/${success +
            failure}/${total} (${inProgressTiles.size})`,
          );
          return;
        }

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
}*/

function generateOutputFile([firstInput], sourceName, minZoom, maxZoom) {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return join(
    'output',
    `${fileName} - ${sourceName.Name} - ${minZoom}-${maxZoom}`,
  );
}

function downloadTiles2({
  inputFiles,
  sourceType,
  sourceName,
  minZoom,
  maxZoom,
  outputType,
  outputFile = generateOutputFile(inputFiles, sourceName, minZoom, maxZoom),
}) {
  try {
    const source = getSource(sourceType, sourceName);
    const packager = getPackager(outputType, outputFile);
    winston.info(
      `Generating tiles, inputFiles: ${JSON.stringify(
        inputFiles,
      )}, source: ${source.Name}, minZoom: ${minZoom}, maxZoom: ${maxZoom}, outputType: ${outputType}`,
    );
    const downloader = new TilesDownloader(
      inputFiles,
      source,
      packager,
      minZoom,
      maxZoom,
    );
    return downloader.getTiles();
  } catch (error) {
    winston.error(`Failed generating tiles`, error);
  }
}

module.exports = {
  downloadTiles2,
};
