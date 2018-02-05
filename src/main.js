const {extname, basename, join} = require('path');
const winston = require('winston');
const {getPackager} = require('./packagers');
const {getRouteSource} = require('./routeSources');
const {getTileSource} = require('./tileSources');
const TilesDownloader = require('./TilesDownloader');

winston.level = 'verbose';

function generateOutputFile([firstInput], sourceName, minZoom, maxZoom) {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return join('output', `${fileName} - ${sourceName} - ${minZoom}-${maxZoom}`);
}

async function downloadTiles({
  inputFiles,
  routeAttribution,
  relationId,
  sourceType,
  sourceName,
  sourceFile,
  minZoom,
  maxZoom,
  outputType,
  outputFile = generateOutputFile(
    inputFiles,
    sourceName || sourceType,
    minZoom,
    maxZoom,
  ),
}) {
  const timer = winston.startTimer();
  try {
    const routeSourceType = inputFiles ? 'localFile' : 'osmRelation';
    const data = inputFiles ? {inputFiles, routeAttribution} : relationId;
    const routeSource = getRouteSource(routeSourceType, data);
    const tileSource = getTileSource(sourceType, sourceName || sourceFile);
    const packager = getPackager(outputType, outputFile);
    winston.info(
      `Generating tiles, routeSource: ${JSON.stringify(
        routeSource.toString(),
      )}, source: ${
        tileSource.Name
      }, minZoom: ${minZoom}, maxZoom: ${maxZoom}, outputType: ${outputType}`,
    );
    const downloader = new TilesDownloader(
      routeSource,
      tileSource,
      packager,
      minZoom,
      maxZoom,
    );
    await downloader.getTiles();
  } catch (error) {
    winston.error(`Failed generating tiles`, error);
  } finally {
    timer.done('Finished downloading tiles');
  }
}

module.exports = {
  downloadTiles,
};
