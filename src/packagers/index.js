const BCNavPackager = require('./BCNavPackager');
const MBTilesPackager = require('./MBTilesPackager');

function getPackager(outputType, output) {
  switch (outputType) {
    case 'BCNav':
      return new BCNavPackager(output);
    case 'MBTiles':
      return new MBTilesPackager(output);
    default:
      throw new Error(`Unknown format type "${outputType}"`);
  }
}

module.exports = {
  getPackager,
};
