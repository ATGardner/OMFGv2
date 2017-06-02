const {buildTileUrl, downloadTile} = require('./utils');

class Source {
  constructor(sourceDescriptor) {
    Object.assign(this, sourceDescriptor);
  }

  async getTileData(tile) {
    const address = buildTileUrl(this.Address, tile);
    try {
      return await downloadTile(address);
    } catch (error) {
      console.error(`Failed getting tile ${tile.toString()} data, error: ${error.message}`);
    }
  }
}

module.exports = Source;