import parser from 'yargs/yargs.js';
export function getParser(processArgs) {
  return parser(processArgs)
    .usage('Usage: $0 [options]')
    .example(
      'node $0 -i "input1.gpx" "input2.kml" -s OpenStreetMap',
      'Download tiles 10-15 along the coordinates from both input files, from OpenStreetMap default tile server',
    )
    .options({
      inputFiles: {
        alias: 'i',
        conflicts: 'r',
        // demandOption: true,
        describe: 'An array of input gpx/kml files',
        normalize: true,
        type: 'array',
      },
      routeAttribution: {
        alias: 'ra',
        describe: 'The source of the input files',
        type: 'string',
      },
      relationId: {
        alias: 'r',
        conflicts: 'i',
        // demandOption: true,
        describe: 'An OSM relation Id',
        type: 'number',
      },
      sourceType: {
        alias: 'st',
        choices: ['Maperitive', 'MB', 'FS', 'WMTS'],
        describe: 'Source type',
        default: 'WMTS',
      },
      sourceFile: {
        alias: 'sf',
        describe: 'Source file',
        type: 'string',
      },
      sourceName: {
        alias: 'sn',
        describe: 'Source tile server name',
        type: 'string',
      },
      minZoom: {
        alias: 'min',
        default: 10,
        describe: 'Minimum required zoom',
        type: 'number',
      },
      maxZoom: {
        alias: 'max',
        default: 15,
        describe: 'Maximum required zoom',
        type: 'number',
      },
      outputFile: {
        alias: 'of',
        describe: 'Output file name',
        normalize: true,
        type: 'string',
      },
      outputType: {
        alias: 'ot',
        choices: ['MBTiles', 'BCNav', 'Both'],
        default: 'Both',
      },
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
    .epilog('copyright 2017');
}
