const {existsSync, readFileSync} = require('fs');
const {join} = require('path');

class FSSource {
  constructor(basePath) {
    this.basePath = basePath;
  }

  get id() {
    return `FS_${this.basePath}`;
  }

  init() {
    // do nothing
  }

  getTileData(tile) {
    const path = join(
      this.basePath,
      `${tile.zoom}`,
      `${tile.x}`,
      `${tile.y}.png`,
    );
    const exists = existsSync(path);
    return exists && readFileSync(path);
  }
}

module.exports = FSSource;
