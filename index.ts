import express, {type ErrorRequestHandler} from 'express';
import {getParser, toDownloadRequest} from './arguments.ts';
import downloadManager from './src/DownloadManager.ts';
import {metricsMiddleware, startMetricsServer} from './src/metrics.ts';
import {errorLogger, getLogger, requestLogger} from './src/utils/logging.ts';

const logger = getLogger('index');
const app = express();

/*
 * `app.use(json())` before, with nothing named `json` in scope — the server
 * threw on its first request. Express 5 bundles body-parser, so this is the
 * same middleware without the separate dependency.
 */
app.use(express.json());
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
  res.status(code).send({status, result});
});

app.get('/blah', (req, res) => {
  const result = new Date().toISOString();
  /*
   * Same reason as the tile failure in DownloadJob: a trailing string argument
   * is dropped by winston, so the timestamp only appears if it is the message.
   */
  logger.verbose(`Got blah ${result}`);
  res.send(result);
});

app.use(errorLogger);

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).send(String(error));
};

app.use(errorHandler);

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  logger.info(`OMFG listening on port ${port}!`);
  process.send?.('ready');
});

startMetricsServer();

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection', error);
});
