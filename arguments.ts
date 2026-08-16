import parser from 'yargs/yargs';
import type {DownloadRequest} from './src/DownloadManager.ts';

export const sourceTypes = ['Maperitive', 'MB', 'FS', 'WMTS'] as const;
export const outputTypes = ['MBTiles', 'BCNav', 'Both'] as const;

/*
 * `yargs/yargs.js` before, which yargs 18's `exports` map does not name — only
 * `.` and `./yargs` are exported, so the old specifier could not resolve at
 * all under a `"type": "module"` package.
 */
export function getParser(processArgs: string[] = []) {
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
        describe: 'An array of input gpx/kml files',
        normalize: true,
        type: 'array' as const,
      },
      routeAttribution: {
        alias: 'ra',
        describe: 'The source of the input files',
        type: 'string' as const,
      },
      relationId: {
        alias: 'r',
        conflicts: 'i',
        describe: 'An OSM relation Id',
        type: 'number' as const,
      },
      sourceType: {
        alias: 'st',
        choices: sourceTypes,
        describe: 'Source type',
        default: 'WMTS' as const,
      },
      sourceFile: {
        alias: 'sf',
        describe: 'Source file',
        type: 'string' as const,
      },
      sourceName: {
        alias: 'sn',
        describe: 'Source tile server name',
        type: 'string' as const,
      },
      minZoom: {
        alias: 'min',
        default: 10,
        describe: 'Minimum required zoom',
        type: 'number' as const,
      },
      maxZoom: {
        alias: 'max',
        default: 15,
        describe: 'Maximum required zoom',
        type: 'number' as const,
      },
      outputFile: {
        alias: 'of',
        describe: 'Output file name',
        normalize: true,
        type: 'string' as const,
      },
      outputType: {
        alias: 'ot',
        choices: outputTypes,
        default: 'Both' as const,
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

/*
 * `.argv` widens to `T | Promise<T>` because a parser with async middleware
 * resolves late; this one has none, but both callers await it anyway so the
 * type stays honest.
 */
export type ParsedArguments = Awaited<ReturnType<typeof getParser>['argv']>;

/*
 * An `array` option is typed `(string | number)[]` by yargs — it cannot know a
 * bare `1` on the command line was meant as a filename — so the narrowing to
 * the shape `DownloadManager` accepts happens here, in one place, rather than
 * being assumed at the call sites.
 */
export function toDownloadRequest(argv: ParsedArguments): DownloadRequest {
  return {
    inputFiles: argv.inputFiles?.map(String),
    routeAttribution: argv.routeAttribution,
    relationId: argv.relationId,
    sourceType: argv.sourceType,
    sourceName: argv.sourceName,
    sourceFile: argv.sourceFile,
    minZoom: argv.minZoom,
    maxZoom: argv.maxZoom,
    outputType: argv.outputType,
    outputFile: argv.outputFile,
  };
}
