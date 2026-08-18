import type {Server} from 'node:http';
import express, {type RequestHandler} from 'express';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import {NotFoundError} from './errors.ts';
import {getLogger} from './utils/logging.ts';

const logger = getLogger('metrics');

/*
 * A dedicated registry rather than prom-client's global one, so importing this
 * module from cli.ts — which pulls it in transitively through DownloadManager
 * — cannot collide with anything else, and tests can build their own.
 * `collectDefaultMetrics` adds the process and Node runtime series: event loop
 * lag, GC pauses, heap and handle counts. Those matter more here than in most
 * services, because a job's tile writes are synchronous SQLite calls sharing
 * the event loop with the HTTP handlers — when `/queue/:id` goes slow, lag is
 * what says whether the download is the reason.
 */
export const registry = new Registry();

collectDefaultMetrics({register: registry});

/*
 * Every duration bucket below is in seconds. The HTTP surface is three fast
 * endpoints — `/downloadTiles` returns 202 as soon as the job is queued, and
 * `/queue/:id` reads an in-memory Map — so the library defaults would put
 * everything in the lowest bucket. These top out at 5s to leave room for a
 * request that was stuck behind a batch of synchronous cache writes.
 */
const httpRequestDuration = new Histogram({
  name: 'omfg_http_request_duration_seconds',
  help: 'Duration of HTTP requests, by matched route and response status',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const tileDownloadDuration = new Histogram({
  name: 'omfg_tile_download_duration_seconds',
  help: 'Duration of outbound tile requests, by outcome',
  labelNames: ['outcome'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

const tileDownloadBytes = new Counter({
  name: 'omfg_tile_download_bytes_total',
  help: 'Bytes of tile data downloaded from tile servers',
  registers: [registry],
});

/*
 * `addDownload` backs off and retries a connection reset or a 503 up to 15
 * times, doubling the wait to a minute. That is invisible from the outside —
 * the tile still succeeds — so without this counter a tile server rate
 * limiting us looks like nothing more than a slow job.
 */
const tileDownloadRetries = new Counter({
  name: 'omfg_tile_download_retries_total',
  help: 'Tile downloads retried after a connection error or a 503',
  registers: [registry],
});

/*
 * Structural rather than `PQueue`, so this module needs no p-queue import for
 * a type it only reads two numbers off.
 */
interface QueueDepth {
  readonly size: number;
  readonly pending: number;
}

/*
 * Zeroed rather than left unset, so a scrape that lands before the download
 * module has registered its queue — or one taken in the CLI, which never
 * serves metrics at all — reports an idle queue instead of dropping the
 * series and leaving a gap in the graph.
 */
let tileQueue: QueueDepth = {size: 0, pending: 0};

/*
 * Both halves of the p-queue: `pending` is the ten in flight, `size` is what
 * waits behind them. Sampled in a `collect` callback rather than kept up to
 * date with inc/dec around every download, because the queue already tracks
 * both and a scrape is the only reader.
 */
const tileQueueDepth = new Gauge({
  name: 'omfg_tile_queue_depth',
  help: 'Tile downloads queued or in flight',
  labelNames: ['state'],
  registers: [registry],
  collect() {
    tileQueueDepth.set({state: 'waiting'}, tileQueue.size);
    tileQueueDepth.set({state: 'running'}, tileQueue.pending);
  },
});

/*
 * The route fetch is one request per job, and the only thing standing between
 * a queued job and the first tile — so when a download seems to hang before
 * anything is downloaded, this is the series that says whether OSM is the
 * reason. Buckets stop at 60s: the API has no dispatcher queue to wait in, and
 * anything slower than that is a failure in progress.
 */
const osmApiRequestDuration = new Histogram({
  name: 'omfg_osm_api_request_duration_seconds',
  help: 'Duration of outbound OSM API requests, by query kind and outcome',
  labelNames: ['query', 'outcome'],
  buckets: [0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60],
  registers: [registry],
});

const jobDuration = new Histogram({
  name: 'omfg_download_job_duration_seconds',
  help: 'Duration of a download job, by outcome',
  labelNames: ['outcome'],
  /*
   * A job walks every tile of a route across the whole zoom range, so minutes
   * is the normal case and an hour is not unusual for a long trail at high
   * zoom. Buckets that stopped at 10s would tell you only that jobs are slow.
   */
  buckets: [1, 10, 30, 60, 300, 900, 1800, 3600, 7200],
  registers: [registry],
});

const jobTiles = new Histogram({
  name: 'omfg_download_job_tiles',
  help: 'Tiles a download job set out to fetch',
  buckets: [100, 1e3, 5e3, 2e4, 1e5, 5e5],
  registers: [registry],
});

/*
 * The per-tile split, which is what turns "the job took 40 minutes" into a
 * reason: a `packaged` tile is one the output file already held and costs
 * nothing, while a rising `failed` share is the tile server refusing us.
 */
const jobTilesProcessed = new Counter({
  name: 'omfg_download_job_tiles_processed_total',
  help: 'Tiles processed by download jobs, by outcome',
  labelNames: ['outcome'],
  registers: [registry],
});

/*
 * DownloadManager runs one job at a time and rejects a second outright, so
 * this is 0 or 1 — a saturation signal, not a queue depth. Paired with the
 * rejection counter it says whether the single-job limit is costing anyone
 * anything.
 */
const jobsActive = new Gauge({
  name: 'omfg_download_jobs_active',
  help: 'Download jobs currently running',
  registers: [registry],
});

const jobsRejected = new Counter({
  name: 'omfg_download_jobs_rejected_total',
  help: 'Download requests refused because a job was already running',
  registers: [registry],
});

/*
 * No separate request counter: a histogram already exports `_count` per label
 * set, so rate() over `omfg_http_request_duration_seconds_count` gives
 * throughput and the `status` label gives the 400-vs-500 split.
 */
export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const stop = httpRequestDuration.startTimer();
  /*
   * `close` rather than `finish`, because a client that gives up polling
   * mid-request is worth seeing: `finish` never fires when the connection is
   * dropped, so those would vanish from the histogram instead of showing up
   * as an abort.
   */
  res.on('close', () => {
    /*
     * The matched route pattern, never `req.path` — `/queue/:id` carries a job
     * id, and labelling by raw path would mint a series per download. Express
     * types `route` loosely, hence the assertion.
     */
    const route = req.route as {path?: string} | undefined;
    stop({
      method: req.method,
      route: route?.path ?? 'unmatched',
      status: res.writableEnded ? res.statusCode : 'aborted',
    });
  });
  next();
};

export function trackTileQueue(queue: QueueDepth): void {
  tileQueue = queue;
}

export async function observeTileDownload<T extends {data?: unknown}>(
  run: () => Promise<T>,
): Promise<T> {
  const stop = tileDownloadDuration.startTimer();
  try {
    const result = await run();
    /*
     * A 304 comes back with no data and costs a round trip but no bandwidth,
     * so folding it into `success` would hide the cache revalidation traffic
     * that a re-run of the same route is almost entirely made of.
     */
    stop({outcome: result.data ? 'success' : 'not_modified'});
    return result;
  } catch (error) {
    stop({outcome: 'error'});
    throw error;
  }
}

export function observeTileBytes(byteLength: number): void {
  tileDownloadBytes.inc(byteLength);
}

export function observeTileRetry(): void {
  tileDownloadRetries.inc();
}

export async function observeOsmApiQuery<T>(
  query: string,
  run: () => Promise<T>,
): Promise<T> {
  const stop = osmApiRequestDuration.startTimer({query});
  try {
    const result = await run();
    stop({outcome: 'success'});
    return result;
  } catch (error) {
    /*
     * A missing relation is someone mistyping an id, not the API failing, and
     * folding the two together would let a bad relation id raise the upstream
     * error rate that alerts hang off.
     */
    stop({outcome: error instanceof NotFoundError ? 'not_found' : 'error'});
    throw error;
  }
}

export function observeJobTiles(count: number): void {
  jobTiles.observe(count);
}

export function observeTileProcessed(
  outcome: 'packaged' | 'fetched' | 'failed',
): void {
  jobTilesProcessed.inc({outcome});
}

export function observeJobRejected(): void {
  jobsRejected.inc();
}

export async function observeJob(run: () => Promise<void>): Promise<void> {
  const stop = jobDuration.startTimer();
  jobsActive.inc();
  try {
    await run();
    stop({outcome: 'success'});
  } catch (error) {
    stop({outcome: 'failure'});
    throw error;
  } finally {
    jobsActive.dec();
  }
}

/*
 * `null` rather than left undeclared: this is the one piece of module state
 * that is set from inside a function, and the disabled path never sets it.
 */
let metricsServer: Server | null = null;

/*
 * Served on its own port, not as a route on the main app. The chart's Ingress
 * and HTTPRoute both send every path to the `http` port, so a `/metrics` route
 * there would publish the server's internals to the internet alongside the
 * API.
 *
 * `METRICS_ENABLED=false` turns the listener off outright, which is what the
 * chart sets when `metrics.enabled` is false. Unset means on, so a local run
 * or a bare `docker run` still exposes metrics without extra ceremony. The
 * port cannot double as the switch — `METRICS_PORT=0` binds a random free port
 * in Node rather than meaning "off".
 */
export function startMetricsServer(): void {
  if (process.env.METRICS_ENABLED === 'false') {
    /*
     * Logged rather than silent: "no metrics" is otherwise indistinguishable
     * from a crashed listener when you go looking for the endpoint.
     */
    logger.info('Metrics disabled by METRICS_ENABLED');
    return;
  }

  const port = Number(process.env.METRICS_PORT) || 9091;
  const metricsApp = express();
  metricsApp.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });
  metricsServer = metricsApp.listen(port, () => {
    logger.info(`Metrics listening on port ${port}`);
  });
}

/*
 * Kept for the shutdown path rather than returned to it: a listening server is
 * a handle that holds the event loop open, so leaving this one running on
 * SIGTERM would make an otherwise idle process sit out the whole grace period
 * and then be killed.
 */
export function stopMetricsServer(): void {
  metricsServer?.close();
}
