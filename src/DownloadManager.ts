import {basename, extname, join} from 'path';
import DownloadJob from './DownloadJob.ts';
import {observeJob, observeJobRejected} from './metrics.ts';
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

export interface PrunedJobs {
  /*
   * Jobs, not files: a `Both` job leaves two files behind and a failed one
   * leaves none, so neither number stands in for the other.
   */
  jobs: number;
  files: string[];
}

export interface JobStatus {
  code: number;
  status?: string;
  result?: unknown;
}

/*
 * The files a job left on disk. `result` is a single name for one packager and
 * an array for `Both`, where MultiPackager returns one per packager — and it
 * is neither for a job that is still running or has failed, which is why the
 * strings are filtered rather than assumed.
 */
function resultFiles(result: unknown): string[] {
  const files = Array.isArray(result) ? (result as unknown[]) : [result];
  return files.filter((file) => typeof file === 'string');
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

    /*
     * A finished job stays in the table. Deleting it here made the first poll
     * that saw `Done` the only one that ever would: every later poll 404s, and
     * the file name that came with it — now the download URL — went with it,
     * so a client that dropped the response, reloaded, or polled twice had no
     * way back to its own output. Nothing prunes the table yet.
     */
    const {code = 200, status, result}: JobState = job.state;
    logger.info(`code: ${code}, status: ${status}, result: ${String(result)}`);
    return {code, status, result};
  }

  /*
   * Every file the jobs still in the table point at, so a sweep of the output
   * directory can tell a result somebody may yet download from what a restart
   * left behind.
   */
  referencedFiles(): string[] {
    return [...this.jobs.values()].flatMap(({state}) =>
      resultFiles(state.result),
    );
  }

  /*
   * Drops every job that finished before `before`, and hands back the files
   * they named so the caller can unlink them — the table is private, and a
   * pruner that reached into it would be free to drop a running job too.
   *
   * A job that is still going has no `finishedAt` at all, so it fails the
   * comparison without a case of its own. Deleting from a Map while iterating
   * it is defined behaviour: the entry is simply not visited again.
   */
  pruneJobs(before: number): PrunedJobs {
    const pruned: PrunedJobs = {jobs: 0, files: []};
    for (const [id, job] of this.jobs) {
      const {finishedAt, result} = job.state;
      if (!finishedAt || finishedAt >= before) {
        continue;
      }

      pruned.jobs += 1;
      pruned.files.push(...resultFiles(result));
      this.jobs.delete(id);
    }

    return pruned;
  }

  private async runDownload(job: DownloadJob): Promise<void> {
    this.downloading = true;
    try {
      await observeJob(() => job.start());
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
      /*
       * Counted separately from the 500 this becomes, because it is not a
       * fault: it is the one-job-at-a-time limit turning someone away, and
       * the only way to tell that the limit is costing anyone anything.
       */
      observeJobRejected();
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
