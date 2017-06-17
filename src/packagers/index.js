const BasePackager = require('./basePackager');

function getPackager(format, output) {
  switch (format){
    case 'MBTiles':
      return new BasePackager(output);
    default:
      throw new Error(`Unknown format type "${format}"`);
  }
}

module.exports = {
  getPackager
};