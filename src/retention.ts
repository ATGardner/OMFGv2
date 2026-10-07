import {readdir, stat, unlink} from 'node:fs/promises';
import {basename, join} from 'path';
import downloadManager, {type PrunedJobs} from './DownloadManager.ts';
import {observeJobsPruned, observeOutputPruned} from './metrics.ts';
import {getLogger} from './utils/logging.ts';

const logger = getLogger('retention');

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/*
 * Relative, like health.ts and the download route: `output/` against the
 * process's cwd, which is /service in the image and where the chart mounts the
 * output volume.
 */
const outputDir = 'output';

/*
 * Two ages, because they answer different questions. A job's entry and its zip
 * go together once the client has had long enough to fetch it — a day. What is
 * left on the volume with no job to claim it can only have come from a pod
 * that was replaced, and a week is long enough that nothing a running job is
 * part-way through writing is ever in range: a job's own files are minutes to
 * hours old, not days.
 *
 * Keeping the job age the shorter of the two is deliberate. `/queue/:id` hands
 * out a download URL for as long as the job is in the table, so a job that
 * outlived its file would advertise a 404.
 */
const jobTtlMs = (Number(process.env.JOB_TTL_HOURS) || 24) * HOUR_MS;
const fileTtlMs = (Number(process.env.OUTPUT_TTL_DAYS) || 7) * DAY_MS;
const intervalMs =
  (Number(process.env.PRUNE_INTERVAL_MINUTES) || 60) * MINUTE_MS;

/*
 * The half of DownloadManager retention needs, spelled out so a test can hand
 * over a table of its own. The manager keeps its Map private on purpose — a
 * pruner reaching into it would be free to drop a running job too.
 */
export interface JobTable {
  pruneJobs(before: number): PrunedJobs;
  referencedFiles(): string[];
}

export interface RetentionOptions {
  dir?: string;
  jobTtlMs?: number;
  fileTtlMs?: number;
  intervalMs?: number;
  jobs?: JobTable;
}

/*
 * Resolves to the bytes it freed, so the caller can account for what a sweep
 * actually took off the volume.
 */
async function remove(dir: string, name: string): Promise<number> {
  const path = join(dir, name);
  try {
    /*
     * Sized before it goes, since there is nothing to ask afterwards. Unlink
     * during an in-flight download is safe either way: it drops the directory
     * entry, and the reader's descriptor holds the inode until it is done.
     */
    const {size} = await stat(path);
    await unlink(path);
    logger.verbose(`Deleted ${path}`);
    return size;
  } catch (error) {
    /*
     * ENOENT is an ordinary outcome rather than a failure: a result whose file
     * somebody removed by hand still names it.
     */
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(`Could not delete ${path}`, error);
    }

    return 0;
  }
}

/*
 * One sweep. Jobs first, so the files they release are gone in the same pass
 * rather than waiting out the orphan age they have just become subject to.
 */
export async function prune({
  dir = outputDir,
  jobTtlMs: jobTtl = jobTtlMs,
  fileTtlMs: fileTtl = fileTtlMs,
  jobs = downloadManager,
}: RetentionOptions = {}): Promise<void> {
  const now = Date.now();
  const {jobs: dropped, files} = jobs.pruneJobs(now - jobTtl);
  /*
   * One file at a time, here and in the orphan pass below. A sweep has all the
   * time in the world and shares the event loop with a job's synchronous
   * SQLite writes, so fanning hundreds of stat/unlink calls out at once would
   * only take that time away from the download it is running beside.
   */
  let bytes = 0;
  for (const file of files) {
    /*
     * By base name, exactly as the download route serves it: a packager's
     * result is a path built against the process's cwd, and the directory
     * being swept is the one that actually holds it.
     */
    bytes += await remove(dir, basename(file));
  }

  if (dropped > 0) {
    observeJobsPruned(dropped);
    observeOutputPruned('expired', bytes);
  }

  /*
   * Anything the surviving jobs still point at is off limits however old it
   * is — the age rule is about what a restart left behind, and after one the
   * table is empty and every file on the volume qualifies.
   */
  const keep = new Set(jobs.referencedFiles().map((file) => basename(file)));
  let orphans = 0;
  let orphanBytes = 0;
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (!entry.isFile() || keep.has(entry.name)) {
      continue;
    }

    const {mtimeMs} = await stat(join(dir, entry.name));
    if (now - mtimeMs < fileTtl) {
      continue;
    }

    orphans += 1;
    orphanBytes += await remove(dir, entry.name);
  }

  if (orphans > 0) {
    observeOutputPruned('orphaned', orphanBytes);
  }

  if (dropped > 0 || files.length > 0 || orphans > 0) {
    logger.info(
      `Pruned ${dropped} jobs, ${files.length + orphans} files, ${
        bytes + orphanBytes
      } bytes`,
    );
  }
}

/*
 * Returns its own stop, rather than exporting a module-level one the way the
 * metrics server does: the timer is the only state here, and handing it back
 * keeps it from becoming state at all.
 */
export function startPruning(options: RetentionOptions = {}): () => void {
  /*
   * Read the way METRICS_ENABLED is, and for the same reason: the chart sets
   * it either way, so the app's default has to be the one a chart-less run
   * wants too — and an output volume that nothing ever prunes fills up.
   */
  if (process.env.RETENTION_ENABLED === 'false') {
    logger.info('Retention is disabled, nothing will be pruned');
    return () => {
      // Nothing was started.
    };
  }

  const run = (): void => {
    prune(options).catch((error: unknown) => {
      /*
       * Swallowed on purpose: a directory that could not be read is worth a
       * line, but not the process — and not a rejection that the interval
       * would raise again an hour later.
       */
      logger.error('Prune failed', error);
    });
  };

  /*
   * Once at boot, because that is when the orphan rule has something to do: a
   * restart empties the table, and waiting out a whole interval to notice the
   * files it left behind gains nothing.
   */
  run();
  const timer = setInterval(run, options.intervalMs ?? intervalMs);
  /*
   * Unreferenced, because index.ts never calls process.exit — it closes both
   * listeners on SIGTERM and lets the process end once it runs out of handles.
   * A referenced interval would hold a drained pod open to its grace period.
   */
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
