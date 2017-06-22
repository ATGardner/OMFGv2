const { exists, existsSync, readFile, readFileSync } = require('fs');
const { join } = require('path');
const { promisify } = require('util');

const existsAsync = promisify(exists);
const readFileAsync = promisify(readFile);

class FSSource {
  constructor(basePath) {
    this.basePath = basePath;
  }

  init() {
    // do nothing
  }

  getTileData(tile) {
    const path = join(this.basePath, `${tile.zoom}`, `${tile.x}`, `${tile.y}.png`);
    const exists = existsSync(path);
    return exists && readFileSync(path);
  }
}

module.exports = FSSource;
