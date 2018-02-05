const BCNavPackager = require('./BCNavPackager');
const MBTilesPackager = require('./MBTilesPackager');
const MultiPackager = require('./MultiPackager');

function getPackager(type, fileName) {
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

module.exports = {
  getPackager,
};
