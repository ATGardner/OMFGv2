const winston = require('winston');
const { downloadTiles2 } = require('./src/main');

winston.level = 'verbose';
const { inputFiles, sourceType, sourceName, outputType, outputFile, minZoom, maxZoom } = require('yargs')
  .usage('Usage: $0 [options]')
  .example(
    'node $0 -i "input1.gpx" "input2.kml" -s OpenStreetMap',
    'Download tiles 10-15 along the coordinates from both input files, from OpenStreetMap default tile server'
  )
  .options({
    inputFiles: {
      alias: 'i',
      demandOption: true,
      describe: 'An array of input gpx/kml files',
      type: 'array'
    },
    sourceType: {
      alias: 'st',
      choices: ['Maperitive', 'MB', 'FS', 'WMTS'],
      default: 'WMTS'
    },
    sourceName: {
      alias: 'sn',
      demandOption: true,
      describe: 'Source tile server address/Maperitive folder',
      type: 'string'
    },
    minZoom: {
      alias: 'min',
      default: 10,
      describe: 'Minimum required zoom',
      type: 'number'
    },
    maxZoom: {
      alias: 'max',
      default: 15,
      describe: 'Maximum required zoom',
      type: 'number'
    },
    outputFile: {
      alias: 'of',
      describe: 'Output file name',
      type: 'string'
    },
    outputType: {
      alias: 'ot',
      choices: ['MBTiles', 'BCNav', 'Both'],
      default: 'MBTiles'
    }
  })
  .help('h')
  .alias('h', 'help')
  .config()
  .epilog('copyright 2017').argv;

(async function() {
    await downloadTiles2({inputFiles, sourceType, sourceName, minZoom, maxZoom, outputType, outputFile});
})();
