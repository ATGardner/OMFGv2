const {buildTileUrl, downloadTile} = require('./utils');

class Source {
  constructor(sourceDescriptor) {
    Object.assign(this, sourceDescriptor);
  }

  getTileData(tile) {
    const address = buildTileUrl(this.Address, tile);
    return downloadTile(address);
  }
}

module.exports = Source;