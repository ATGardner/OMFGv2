const { extname, basename } = require('path');
const winston = require('winston');
const { downloadTiles } = require('./src/main');
const { getPackager } = require('./src/packagers');
const {getSource} = require('./src/sources');
const sources = require('./sources.json');

winston.level = 'verbose';
const {
  inputFiles,
  source,
  minZoom,
  maxZoom,
  output = generateOutput(inputFiles, source, minZoom, maxZoom),
  target
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
    s: {
      alias: 'source',
      coerce: arg => {
        const sourceDescriptor = sources.find(({ Name }) => Name === arg);
        if (!sourceDescriptor) {
          throw new Error(`Could not find source "${arg}"`);
        }

        return getSource(sourceDescriptor);
      },
      demandOption: true,
      describe: 'Source tile server address',
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
    t: {
      alias: 'target',
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
    winston.info(`Generating tiles, inputFiles: ${JSON.stringify(inputFiles)}, source: ${source.Name}, minZoom: ${minZoom}, maxZoom: ${maxZoom}, target: ${target}`);
    const packager = getPackager(target, output);
    await downloadTiles(inputFiles, source, minZoom, maxZoom, packager);
  } catch (error) {
    winston.error(`Failed generating tiles`, error);
  }
})();
