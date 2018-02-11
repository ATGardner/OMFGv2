const {extname, basename, join} = require('path');
const winston = require('winston');
const {getPackager} = require('./packagers');
const {getRouteSource} = require('./routeSources');
const {getTileSource} = require('./tileSources');
const DownloadJob = require('./DownloadJob');

winston.level = 'verbose';
const jobs = new Map();

function generateOutputFile([firstInput], sourceName, minZoom, maxZoom) {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return join('output', `${fileName} - ${sourceName} - ${minZoom}-${maxZoom}`);
}

function awaitJob(id) {
  const job = jobs.get(id);
  if (!job) {
    throw new Error(`Job ${id} not found`);
  }

  return job.promise;
}

function checkStatus(id) {
  const job = jobs.get(id);
  if (!job) {
    return {
      code: 404,
      status: 'Not Found',
    };
  }

  const {state: {code = 200, status, result}} = job;
  if (status === 'Done') {
    jobs.delete(id);
  }

  return {code, status, result};
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
  const routeSourceType = inputFiles ? 'localFile' : 'osmRelation';
  const data = inputFiles ? {inputFiles, routeAttribution} : relationId;
  const routeSource = getRouteSource(routeSourceType, data);
  const tileSource = getTileSource(sourceType, sourceName || sourceFile);
  const packager = getPackager(outputType, outputFile);
  const job = new DownloadJob(
    routeSource,
    tileSource,
    packager,
    minZoom,
    maxZoom,
  );
  jobs.set(job.id, job);
  job.start();
  return job.id;
}

module.exports = {
  awaitJob,
  checkStatus,
  downloadTiles,
};
