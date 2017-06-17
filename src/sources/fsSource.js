const { readFile } = require('fs');
const { join } = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(readFile);

class FSSource {
  constructor(basePath) {
    this.basePath = basePath;
  }

  init() {
    // do nothing
  }

  async getTileData(tile) {
    const path = join(this.basePath, `${tile.zoom}`, `${tile.x}`, `${tile.y}.png`);
    return readFileAsync(path);
  }
}

module.exports = FSSource;
