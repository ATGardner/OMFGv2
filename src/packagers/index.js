const BasePackager = require('./basePackager');

function getPackager(outputType, output) {
  switch (outputType){
    case 'MBTiles':
      return new BasePackager(output);
    default:
      throw new Error(`Unknown format type "${outputType}"`);
  }
}

module.exports = {
  getPackager
};