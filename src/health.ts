import {constants} from 'node:fs';
import {access, mkdir} from 'node:fs/promises';
import {Router} from 'express';
import {getLogger} from './utils/logging.ts';

const logger = getLogger('health');

/*
 * Relative, because that is how the app builds every path it writes: caches
 * land in `cache/<source>` and packaged output in `output/`, both resolved
 * against the process's cwd — /service in the image. The chart mounts its
 * volume at /service/cache, so `cache` is the directory that is somebody
 * else's disk and the one worth probing.
 */
const dataDirs = ['cache', 'output'] as const;

let draining = false;

/*
 * Flipped by the SIGTERM handler rather than read from a signal here, so the
 * module stays a plain readiness check that the tests can drive.
 */
export function beginDraining(): void {
  draining = true;
}

/*
 * Called once at startup, so a volume the pod cannot write to fails the
 * readiness probe immediately instead of surfacing an hour into a download as
 * a failed tile write. Not fatal: a pod that starts and never goes ready says
 * what is wrong in `kubectl describe`, where a crash loop only says it died.
 */
export async function ensureDataDirs(
  dirs: readonly string[] = dataDirs,
): Promise<void> {
  await Promise.all(
    dirs.map(async (dir) => {
      try {
        await mkdir(dir, {recursive: true});
      } catch (error) {
        logger.error(`Could not create ${dir}`, error);
      }
    }),
  );
}

interface DirCheck {
  dir: string;
  error?: string;
}

/*
 * `W_OK` on the directory rather than a probe write: it answers the question
 * that actually goes wrong here — the chart's own comment notes that a volume
 * provisioned without a matching fsGroup is owned by root and unwritable, and
 * that the first tile write is what discovers it — without adding a file
 * create and unlink to every probe cycle.
 */
function checkDataDirs(dirs: readonly string[]): Promise<DirCheck[]> {
  return Promise.all(
    dirs.map(async (dir) => {
      try {
        await access(dir, constants.W_OK);
        return {dir};
      } catch (error) {
        return {dir, error: (error as NodeJS.ErrnoException).code ?? 'EACCES'};
      }
    }),
  );
}

export interface HealthOptions {
  dirs?: readonly string[];
  isDraining?: () => boolean;
}

/*
 * A factory rather than a ready-made router, so the tests can point the checks
 * at a temp directory and supply their own drain flag instead of mutating
 * module state that the next test would inherit.
 */
export function createHealthRouter({
  dirs = dataDirs,
  isDraining = () => draining,
}: HealthOptions = {}): Router {
  const router = Router();

  /*
   * Liveness answers one question — is this process still able to run a
   * handler — so it checks nothing else on purpose. A liveness probe that
   * failed on a bad volume or an unreachable tile server would restart a pod
   * that a restart cannot fix, and the restart would take a running download
   * with it. It stays 200 while draining too; that is readiness's business.
   */
  router.get('/healthz', (req, res) => {
    res.send({status: 'ok', uptime: Math.round(process.uptime())});
  });

  /*
   * Readiness answers whether this pod should be sent traffic. Deliberately
   * not tied to whether a download is running: DownloadManager takes one job
   * at a time and refuses a second, but `/queue/:id` polling has to keep
   * working for the whole length of that job, and going unready would pull the
   * only replica out of the Service and break exactly the client waiting on
   * it. Saturation is what `omfg_download_jobs_active` is for.
   */
  router.get('/readyz', async (req, res) => {
    if (isDraining()) {
      res.status(503).send({status: 'draining'});
      return;
    }

    const checks = await checkDataDirs(dirs);
    const failed = checks.filter(({error}) => error);
    if (failed.length > 0) {
      res.status(503).send({status: 'unavailable', checks: failed});
      return;
    }

    res.send({status: 'ready'});
  });

  return router;
}
