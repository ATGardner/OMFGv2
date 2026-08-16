import {basename, extname, join} from 'path';
import DownloadJob from './DownloadJob.ts';
import {getPackager} from './packagers/index.ts';
import {getRouteSource} from './routeSources/index.ts';
import {getTileSource} from './tileSources/index.ts';
import type {JobState} from './types.ts';
import {getLogger} from './utils/logging.ts';

const logger = getLogger('downloadManager');

export interface DownloadRequest {
  inputFiles?: string[];
  routeAttribution?: string;
  relationId?: number;
  sourceType: string;
  sourceName?: string;
  sourceFile?: string;
  minZoom: number;
  maxZoom: number;
  outputType: string;
  outputFile?: string;
}

export interface JobStatus {
  code: number;
  status?: string;
  result?: unknown;
}

function generateOutputFile(
  [firstInput]: string[],
  sourceName: string,
  minZoom: number,
  maxZoom: number,
): string {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return join('output', `${fileName} - ${sourceName} - ${minZoom}-${maxZoom}`);
}

class DownloadManager {
  private downloading = false;

  private readonly jobs = new Map<string, DownloadJob>();

  /*
   * Resolves with the job's result — the packaged file names — rather than the
   * `undefined` the bare job promise carries. The CLI prints what comes back,
   * and printing `undefined` was all it could ever do.
   */
  async awaitDownload(id: string): Promise<unknown> {
    const job = this.jobs.get(id);
    if (!job?.promise) {
      throw new Error(`Job ${id} not found`);
    }

    await job.promise;
    return job.state.result;
  }

  getJobStatus(id: string): JobStatus {
    const job = this.jobs.get(id);
    if (!job) {
      return {
        code: 404,
        status: 'Not Found',
      };
    }

    const {code = 200, status, result}: JobState = job.state;
    if (status === 'Done') {
      this.jobs.delete(id);
    }

    logger.info(`code: ${code}, status: ${status}, result: ${String(result)}`);
    return {code, status, result};
  }

  private async runDownload(job: DownloadJob): Promise<void> {
    this.downloading = true;
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
    outputFile,
  }: DownloadRequest): string {
    if (this.downloading) {
      throw new Error('Download queue is full');
    }

    const routeSource = inputFiles
      ? getRouteSource('localFile', {inputFiles, routeAttribution})
      : getRouteSource('osmRelation', relationId!);
    const tileSource = getTileSource(
      sourceType,
      sourceName ?? sourceFile ?? '',
    );
    if (!tileSource) {
      throw new Error(`Unknown source type "${sourceType}"`);
    }

    /*
     * Defaulted here rather than in the destructuring pattern, where it read
     * `inputFiles` — the parameter it sits beside — and so threw on the OSM
     * relation path, which has none.
     */
    const output =
      outputFile ??
      generateOutputFile(
        inputFiles ?? [`relation-${relationId}`],
        sourceName ?? sourceType,
        minZoom,
        maxZoom,
      );
    const packager = getPackager(outputType, output);
    const job = new DownloadJob(
      routeSource,
      tileSource,
      packager,
      minZoom,
      maxZoom,
    );
    this.jobs.set(job.id, job);
    /*
     * Kept on the job so `awaitDownload` can hand it to the CLI. The `catch`
     * is what keeps a failed job from becoming an unhandled rejection when
     * nobody awaits it, which is the HTTP path — `getJobStatus` reads the
     * failure off `job.state` instead.
     */
    job.promise = this.runDownload(job);
    job.promise.catch((error: unknown) => {
      logger.error(`Job ${job.id} failed`, error);
    });
    return job.id;
  }
}

export default new DownloadManager();
