const { basename, extname } = require('path');
const sqlite3 = require('sqlite3');
const Database = require('../utils/sqlite3-async');

class MBSource {
  constructor(filename) {
    this.db = new Database(filename, sqlite3.OPEN_READ);
    const ext = extname(filename);
    this.Name = basename(filename, ext);
  }

  async init() {
    await this.db.init();
    this.selectStatement = await this.db.prepare(
      'SELECT tile_data FROM tiles WHERE tile_column = $tile_column AND tile_row = $tile_row AND zoom_level = $zoom_level;',
    );
  }

  async getTileData(tile) {
    const $tile_row = (1 << tile.zoom) - tile.y - 1;
    const row = await this.selectStatement.get({
      $tile_column: tile.x,
      $tile_row,
      $zoom_level: tile.zoom,
    });
    if (row) {
      return row.tile_data;
    }
  }
}

module.exports = MBSource;
