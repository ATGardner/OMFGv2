const {extname, basename, join} = require('path');
const {getLogger} = require('./utils/logging');
const {getPackager} = require('./packagers');
const {getRouteSource} = require('./routeSources');
const {getTileSource} = require('./tileSources');
const DownloadJob = require('./DownloadJob');

const logger = getLogger('downloadManager');

function generateOutputFile([firstInput], sourceName, minZoom, maxZoom) {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return join('output', `${fileName} - ${sourceName} - ${minZoom}-${maxZoom}`);
}

class DownloadManager {
  constructor() {
    this.downloading = false;
    this.jobs = new Map();
  }

  awaitDownload(id) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }

    return job.promise;
  }

  getJobStatus(id) {
    const job = this.jobs.get(id);
    if (!job) {
      return {
        code: 404,
        status: 'Not Found',
      };
    }

    const {
      state: {code = 200, status, result},
    } = job;
    if (status === 'Done') {
      this.jobs.delete(id);
    }

    logger.info(`code: ${code}, status: ${status}, result: ${result}`);
    return {code, status, result};
  }

  async addDownload(job) {
    this.downloading = true;
    this.jobs.set(job.id, job);
    try {
      await job.start();
    } finally {
      this.downloading = false;
    }
  }

  startDownload({
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
    if (this.downloading) {
      throw new Error('Download queue is full');
    }

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
    this.addDownload(job);
    return job.id;
  }
}

module.exports = new DownloadManager();
