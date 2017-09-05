const {json} = require('body-parser');
const express = require('express');
const winston = require('winston');
const yargs = require('./arguments');
const {downloadTiles2} = require('./src/main');

const app = express();

app.use(json());

app.post('/', async (req, res) => {
  try {
    const args = yargs.config(req.body).argv;
    await downloadTiles2(args);
    res.send('Done');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(3000, () => {
  winston.log('Example app listening on port 3000!');
});
