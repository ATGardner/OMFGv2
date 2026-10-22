import express, {type ErrorRequestHandler} from 'express';
import {getParser, toDownloadRequest} from './arguments.ts';
import downloadManager from './src/DownloadManager.ts';
import {
  beginDraining,
  createHealthRouter,
  ensureDataDirs,
} from './src/health.ts';
import {
  metricsMiddleware,
  startMetricsServer,
  stopMetricsServer,
} from './src/metrics.ts';
import {createOutputRouter, toDownloadUrls} from './src/output.ts';
import {startPruning} from './src/retention.ts';
import {errorLogger, getLogger, requestLogger} from './src/utils/logging.ts';

const logger = getLogger('index');
const app = express();

/*
 * `app.use(json())` before, with nothing named `json` in scope — the server
 * threw on its first request. Express 5 bundles body-parser, so this is the
 * same middleware without the separate dependency.
 */
app.use(express.json());

/*
 * Ahead of both middlewares below, unlike every other route: the kubelet
 * probes these every few seconds for the life of the pod, so counting them
 * would bury the API's own throughput under probe traffic in the request
 * histogram, and logging them would cost a line every few seconds forever.
 */
app.use(createHealthRouter());

app.use(requestLogger);
// Ahead of the routes, so unmatched paths and error responses are counted too.
app.use(metricsMiddleware);

/*
 * Express 5 forwards a rejected handler promise to the error middleware on its
 * own, which is what the hand-rolled `next(error, req, res)` was trying to do —
 * with arguments `next` does not take.
 */
app.post('/downloadTiles', async (req, res) => {
  const argv = await getParser()
    .config(req.body as Record<string, unknown>)
    .exitProcess(false).argv;
  const id = downloadManager.startDownload(toDownloadRequest(argv));
  res.status(202).send({id});
});

app.get('/queue/:id', ({params: {id}}, res) => {
  const {code, status, result} = downloadManager.getJobStatus(id);
  /*
   * `result` stays exactly as the job reported it — an ETA, an Error or the
   * packager's own paths. `downloads` is the part a client can act on: the
   * URLs of the route below, which is the only way the packaged file leaves
   * this container.
   */
  res
    .status(code)
    .send({status, result, downloads: toDownloadUrls(status, result)});
});

/*
 * After the routes above rather than beside the health router, on purpose:
 * downloads belong in the request log and in the metrics histogram, and the
 * route pattern `/output/:file` keeps that a single series.
 */
app.use(createOutputRouter());

app.use(errorLogger);

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).send(String(error));
};

app.use(errorHandler);

/*
 * Before the listener, so a volume the pod cannot write to is already failing
 * readiness by the time the first probe arrives, rather than being discovered
 * by a tile write an hour into a download.
 */
await ensureDataDirs();

const port = process.env.PORT ?? 3000;
const server = app.listen(port, () => {
  logger.info(`OMFG listening on port ${port}!`);
});

startMetricsServer();

/*
 * After the listener rather than before it: the boot sweep reads the whole
 * output directory, and there is no reason to make the first readiness probe
 * wait behind it.
 */
const stopPruning = startPruning();

/*
 * One readiness period at the chart's default, which is what the flag above
 * needs to be seen: the kubelet keeps routing to this pod until its own probe
 * fails and the endpoints controller catches up, so closing the listener the
 * instant SIGTERM lands would refuse requests that were already on their way.
 */
const DRAIN_MS = 10_000;

/*
 * Nothing here calls process.exit. With both listeners closed an idle process
 * runs out of handles and ends on its own, while one still running a download
 * keeps going until the job finishes or the grace period expires — which is
 * the better of the two outcomes for a job that has been fetching tiles for an
 * hour.
 */
process.once('SIGTERM', () => {
  logger.info('SIGTERM received, draining');
  beginDraining();
  setTimeout(() => {
    server.close(() => {
      logger.info('API listener closed');
    });
    // Keep-alive sockets sitting idle would otherwise hold `close` open.
    server.closeIdleConnections();
    stopMetricsServer();
    stopPruning();
  }, DRAIN_MS).unref();
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection', error);
});
