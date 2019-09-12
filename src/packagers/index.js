import BCNavPackager from './BCNavPackager.js';import MBTilesPackager from './MBTilesPackager.js';import MultiPackager from './MultiPackager.js';export function getPackager(type, fileName) {  switch (type) {    case 'BCNav':      return new BCNavPackager(fileName);    case 'MBTiles':      return new MBTilesPackager(fileName);    case 'Both':      return new MultiPackager(fileName, BCNavPackager, MBTilesPackager);    default:      throw new Error(`Unknown output type "${type}"`);  }}