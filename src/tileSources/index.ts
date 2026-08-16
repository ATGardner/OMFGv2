import type {SourceDescriptor, TileSource} from '../types.ts';
import FSSource from './fsSource.ts';
import JPEGSource from './jpegSource.ts';
import MBSource from './mbSource.ts';
import sourcesJson from './sources.json' with {type: 'json'};
import WMTSSource from './wmtsSource.ts';

/*
 * The import attribute is what makes this legal ESM — the bare
 * `import sources from './sources.json'` this replaces is a syntax error under
 * a `"type": "module"` package, which is one reason the WMTS path could never
 * have run. The cast names the shape the file is maintained in; the inferred
 * literal type would make `compress` unreachable on the entries that omit it.
 */
const sources = sourcesJson as SourceDescriptor[];

export function getTileSource(
  sourceType: string,
  source: string,
): TileSource | undefined {
  switch (sourceType) {
    case 'MB':
      return new MBSource(source);
    case 'FS':
      return new FSSource(source);
    case 'WMTS': {
      const sourceDescriptor = sources.find(({Name}) => Name === source);
      if (!sourceDescriptor) {
        throw new Error(`Could not find WMTS source "${source}"`);
      }

      return sourceDescriptor.compress
        ? new JPEGSource(sourceDescriptor)
        : new WMTSSource(sourceDescriptor);
    }

    default:
      return undefined;
  }
}
