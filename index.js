const { extname, basename } = require('path');
const winston = require('winston');
const { downloadTiles } = require('./src/main');
const { getSource } = require('./src/sources');
const { getPackager } = require('./src/packagers');

winston.level = 'verbose';
const {
  inputFiles,
  sourceType,
  s,
  minZoom,
  maxZoom,
  o,
  outputType
} = require('yargs')
  .usage('Usage: $0 [options]')
  .example(
    'node $0 -i "input1.gpx" "input2.kml" -s OpenStreetMap',
    'Download tiles 10-15 along the coordinates from both input files, from OpenStreetMap default tile server'
  )
  .options({
    i: {
      alias: 'inputFiles',
      demandOption: true,
      describe: 'An array of input gpx/kml files',
      type: 'array'
    },
    st: {
      alias: 'sourceType',
      choices: ['Maperitive', 'MB', 'FS', 'WMTS'],
      default: 'WMTS'
    },
    s: {
      alias: 'source',
      demandOption: true,
      describe: 'Source tile server address/Maperitive folder',
      type: 'string'
    },
    min: {
      alias: 'minZoom',
      default: 10,
      describe: 'Minimum required zoom',
      type: 'number'
    },
    max: {
      alias: 'maxZoom',
      default: 15,
      describe: 'Maximum required zoom',
      type: 'number'
    },
    o: {
      alias: 'output',
      describe: 'Reverse way sort and marker order',
      type: 'string'
    },
    ot: {
      alias: 'outputType',
      choices: ['MBTiles', 'BCNav', 'Both'],
      default: 'MBTiles'
    }
  })
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2017').argv;

function generateOutput([firstInput], source, minZoom, maxZoom) {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return `${fileName} - ${source.Name} - ${minZoom}-${maxZoom}`;
}

(async function() {
  try {
    const source = getSource(sourceType, s);
    const output = o || generateOutput(inputFiles, source, minZoom, maxZoom);
    const packager = getPackager(outputType, output);
    winston.info(
      `Generating tiles, inputFiles: ${JSON.stringify(
        inputFiles
      )}, source: ${source.Name}, minZoom: ${minZoom}, maxZoom: ${maxZoom}, outputType: ${outputType}`
    );
    await downloadTiles(inputFiles, source, minZoom, maxZoom, packager);
  } catch (error) {
    winston.error(`Failed generating tiles`, error);
  }
})();
