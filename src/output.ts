import {basename, resolve} from 'path';
import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {getLogger} from './utils/logging.ts';

const logger = getLogger('output');

/*
 * Relative, like every path this app writes: the packagers build
 * `output/<name>.zip` against the process's cwd — /service in the image — and
 * the chart mounts the output volume there. Kept beside the route that serves
 * it so the two cannot drift onto different directories.
 */
const outputDir = 'output';

/*
 * The URL prefix, which is deliberately not derived from `outputDir`: the
 * directory is where the file sits on disk and a test can point it elsewhere,
 * while this is a published path that clients hold on to.
 */
const downloadPath = '/output';

export interface OutputOptions {
  dir?: string;
}

/*
 * What a client should follow, given what a packager returned. `close` hands
 * back a filesystem path — `output/relation-282071 - OpenStreetMap - 10-12 -
 * Orux.zip` — which is worth nothing to anyone outside this process, and whose
 * spaces make it an invalid URL besides.
 */
function toDownloadUrl(file: string): string {
  return `${downloadPath}/${encodeURIComponent(basename(file))}`;
}

/*
 * `result` only holds file names once the job is Done: while it runs it is the
 * estimated milliseconds left, and a failed job puts its Error there. An array
 * is the `Both` output type, where MultiPackager returns one name per packager.
 */
export function toDownloadUrls(
  status: string | undefined,
  result: unknown,
): string[] | undefined {
  if (status !== 'Done') {
    return undefined;
  }

  const files = Array.isArray(result) ? (result as unknown[]) : [result];
  return files.filter((file) => typeof file === 'string').map(toDownloadUrl);
}

/*
 * A factory rather than a ready-made router, matching `createHealthRouter`, so
 * the tests can serve a temp directory instead of whatever the working
 * directory happens to hold.
 *
 * Keyed on the file name rather than the job id: a job's entry is not the
 * file's owner — the same packaged zip stays downloadable across restarts and
 * long after the job that produced it has left the table.
 */
export function createOutputRouter({
  dir = outputDir,
}: OutputOptions = {}): Router {
  const root = resolve(dir);
  const router = Router();

  /*
   * The one handler in the app that reads a file off disk per request, and the
   * files run to hundreds of megabytes — so a loop over a URL somebody already
   * has keeps the volume busy and the event loop stalled without ever starting
   * a job. That shape is what CodeQL's js/missing-rate-limiting is about.
   *
   * Generous on purpose: a client fetches its zip once, twice if a transfer
   * breaks. And scoped to this router rather than the app, because /healthz
   * and /readyz are probed every few seconds for the life of the pod — a
   * limited readiness probe would eventually restart the pod it was
   * protecting.
   *
   * Behind an Ingress every request arrives from the controller's own address,
   * so without `trust proxy` this is one budget for the whole cluster rather
   * than one per client. That is the safe direction to be wrong in — the
   * header the alternative trusts is written by the client — and it is why the
   * limit is a minute of downloading rather than a handful of requests. The
   * validator that warns about that same mismatch is turned off for it.
   *
   * Built per router, not per module: a shared counter would carry state from
   * one test into the next.
   */
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: {xForwardedForHeader: false},
  });

  /*
   * The parameter type is spelled out because the middleware costs Express its
   * inference: with a second handler in the call, `:file` widens to
   * `string | string[]` rather than the string the path describes.
   */
  router.get<{file: string}>(
    `${downloadPath}/:file`,
    limiter,
    ({params: {file}}, res) => {
      /*
       * `root` is what makes the parameter safe. send() resolves the name inside
       * it and answers 403 for anything that climbs out, so an encoded `../` —
       * which Express hands over decoded, as a name with a slash in it — is a
       * refusal rather than a read of the filesystem.
       *
       * The name doubles as the download name: `output/` holds nothing but
       * packaged results, and the packager already named them for the route,
       * source and zoom range they came from.
       */
      res.download(file, file, {root, dotfiles: 'deny'}, (error?: Error) => {
        if (!error) {
          return;
        }

        /*
         * A file that is missing or out of bounds fails before anything is
         * written, and send() puts the status it wanted on the error. Failing
         * part-way through a multi-megabyte zip is the other case: the 200 is
         * already on the wire, so the only honest end is a broken connection —
         * a client that gets one knows its copy is short, where a 500 appended
         * to the body would leave it looking complete.
         */
        const {status = 500} = error as Error & {status?: number};
        if (res.headersSent) {
          logger.warn(`Download of ${file} failed mid-stream`, error);
          res.destroy();
          return;
        }

        if (status >= 500) {
          logger.error(`Could not serve ${file}`, error);
        }

        res.sendStatus(status);
      });
    },
  );

  return router;
}
