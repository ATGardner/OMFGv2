const { join } = require('path');
const FSSource = require('./fsSource');

class MaperitiveSource extends FSSource {
  constructor(maperitiveFolder) {
    super(join(maperitiveFolder, 'tiles'));
    this.maperitiveFolder = maperitiveFolder;
    this.tilesToGenerate = new Set();
    this.maxZoom = 0;
    this.tcs = new Promise(resolve => {
      this.resolve = resolve;
    });
  }

  async getTileData(tile) {
    const data = await super.getTileData(tile);
    if (data) {
      return data;
    }

    this.tilesToGenerate.add(tile);
    this.maxZoom = Math.max(this.maxZoom, tile.zoom);
    await this.tcs;
    return super.getTileData(tile);
  }

  async generateAllTiles() {
    this.resolve();
  }
}

module.exports = MaperitiveSource;