import type {Packager} from '../types.ts';
import BCNavPackager from './BCNavPackager.ts';
import MBTilesPackager from './MBTilesPackager.ts';
import MultiPackager from './MultiPackager.ts';

export function getPackager(type: string, fileName: string): Packager {
  switch (type) {
    case 'BCNav':
      return new BCNavPackager(fileName);
    case 'MBTiles':
      return new MBTilesPackager(fileName);
    case 'Both':
      return new MultiPackager(fileName, BCNavPackager, MBTilesPackager);
    default:
      throw new Error(`Unknown output type "${type}"`);
  }
}
