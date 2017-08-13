const { json } = require('body-parser');
const express = require('express');
const yargs = require('./arguments');
const { downloadTiles2 } = require('./src/main');

const app = express();

app.use(json());

app.post('/', async (req, res) => {
  try {
    const arguments = yargs.config(req.body).argv;
    await downloadTiles2(arguments);
    res.send('Done');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
});
