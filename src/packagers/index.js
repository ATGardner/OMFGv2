const BCNavPackager = require('./BCNavPackager');
const MBTilesPackager = require('./MBTilesPackager');
const MultiPackager = require('./MultiPackager');

function getPackager(outputType, output) {
  switch (outputType) {
    case 'BCNav':
      return new BCNavPackager(output);
    case 'MBTiles':
      return new MBTilesPackager(output);
    case 'Both':
      return new MultiPackager(output, BCNavPackager, MBTilesPackager);
    default:
      throw new Error(`Unknown format type "${outputType}"`);
  }
}

module.exports = {
  getPackager,
};
