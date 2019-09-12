//npm i --target_platform=win --target_arch=x64

import express from 'express';
import {getParser} from './arguments.js';
import downloadManager from './src/DownloadManager.js';
import {errorLogger, getLogger, requestLogger} from './src/utils/logging.js';
const logger = getLogger('index');
const app = express();
app.use(json());
app.use(requestLogger);
app.post('/downloadTiles', async (req, res, next) => {
  try {
    const {argv} = getParser()
      .config(req.body)
      .exitProcess(false);
    const id = await downloadManager.startDownload(argv);
    res.status(202).send({id});
  } catch (error) {
    next(error, req, res);
  }
});
app.get('/queue/:id', async ({params: {id}}, res) => {
  const {code, status, result} = downloadManager.getJobStatus(id);
  res.status(code).send({status, result});
});
app.get('/blah', (req, res) => {
  const result = new Date().toISOString();
  logger.verbose('Got blah', result);
  res.send(result);
});
app.use(errorLogger);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).send(err.toString());
});
app.listen(process.env.PORT || 3000, () => {
  logger.info('Example app listening on port 3000!');
  process.send && process.send('ready');
});
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', error);
});
process.on('unhandledRejection', error => {
  logger.error('Unhandled Rejection', error);
});
