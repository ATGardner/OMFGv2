const { extname, basename } = require('path');
const { downloadTiles } = require('./src/main');
const sources = require('./sources.json');
const { inputFiles, source, minZoom, maxZoom, output = generateOutput(inputFiles, minZoom, maxZoom)} = require('yargs')
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
        const source = sources.find(({Name}) => Name === arg);
        if (!source) {
          throw new Error(`Could not find source "${arg}"`);
        }

        return source;
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
      type: 'bool'
    }
  })
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2017').argv;

function generateOutput([firstInput], source, minZoom, maxZoom) {
  const ext = extname(firstInput);
  const fileName = basename(firstInput, ext);
  return `${fileName} - ${source.name} - ${minZoom}-${maxZoom}`;
}

(async function() {
  try {
    await downloadTiles(inputFiles, source, minZoom, maxZoom, output);
  } catch (error) {
    console.error(error);
  }
})();
