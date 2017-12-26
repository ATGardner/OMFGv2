const {extname, basename, join} = require('path');
const winston = require('winston');
const {getPackager} = require('./packagers');
const {getGeoSource} = require('./geoSources');
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
    const geoSourceType = inputFiles ? 'localFile' : 'osmRelation';
    const geoSource = getGeoSource(geoSourceType, inputFiles || relationId);
    const tileSource = getTileSource(sourceType, sourceName || sourceFile);
    const packager = getPackager(outputType, outputFile);
    winston.info(
      `Generating tiles, geoSource: ${JSON.stringify(
        geoSource.toString(),
      )}, source: ${
        tileSource.Name
      }, minZoom: ${minZoom}, maxZoom: ${maxZoom}, outputType: ${outputType}`,
    );
    const downloader = new TilesDownloader(
      geoSource,
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

process.on('uncaughtException', error => {
  winston.error('Uncaught Exception', error);
});

process.on('unhandledRejection', error => {
  winston.error('Unhandled Rejection', error);
});

module.exports = {
  downloadTiles,
};
