const {json} = require('body-parser');
const express = require('express');
const winston = require('winston');
const {config} = require('./arguments');
const {downloadTiles} = require('./src/main');

const app = express();
app.use(json());
app.post('/downloadTiles', async (req, res) => {
  try {
    const argv = config(req.body).exitProcess(false);
    await downloadTiles(argv.argv);
    res.send('Done');
  } catch (error) {
    res.status(500).send(error);
  }
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
