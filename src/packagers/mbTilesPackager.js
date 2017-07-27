const {format} = require('path');
const BasePackager = require('./basePackager');

class MBTilesPackager extends BasePackager {
  constructor(fileName) {
    super(format({name: fileName, ext: 'mbtiles'}));
  }
}

module.exports = MBTilesPackager;