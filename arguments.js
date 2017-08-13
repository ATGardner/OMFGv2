const yargs = require('yargs')
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
      normalize: true,
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
      describe: 'Source tile server name/Maperitive folder',
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
      normalize: true,
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
  .check(({minZoom, maxZoom}) => {
    if (minZoom < 0) {
      throw new Error('minZoom must be >= 0');
    }

    if (minZoom > maxZoom) {
      throw new Error('minZoom must be <= maxZoom');
    }

    if (maxZoom > 20) {
      throw new Error('maxZoom must be <= 20');
    }

    return true;
  })
  .config()
  .epilog('copyright 2017');

module.exports = yargs;
