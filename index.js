const {json} = require('body-parser');
const express = require('express');
const winston = require('winston');
const parser = require('./arguments');
const {checkStatus, downloadTiles} = require('./src/main');

const app = express();
app.use(json());
app.post('/downloadTiles', async (req, res, next) => {
  try {
    const {argv} = parser()
      .config(req.body)
      .exitProcess(false);
    const id = await downloadTiles(argv);
    res.status(202).send({id});
  } catch (error) {
    next(error, req, res);
  }
});
app.get('/queue/:id', async ({params: {id}}, res) => {
  const {code, status, result} = checkStatus(id);
  res.status(code).send({status, result});
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  winston.error(err.stack);
  res.status(500).send(err.toString());
});
app.listen(3000, () => {
  winston.log('Example app listening on port 3000!');
});
process.on('uncaughtException', error => {
  winston.error('Uncaught Exception', error);
});
process.on('unhandledRejection', error => {
  winston.error('Unhandled Rejection', error);
});
