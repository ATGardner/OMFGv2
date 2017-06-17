const Database = require('../utils/sqlite3-async');

class BasePackager {
  constructor(filename) {
    this.db = new Database(filename);
  }

  async init() {
    await this.db.init();
    await this.db.run('CREATE TABLE IF NOT EXISTS tiles (tile_column integer, tile_row integer, zoom_level integer, tile_data blob, PRIMARY KEY (tile_column, tile_row, zoom_level));');
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (tile_column, tile_row, zoom_level);');
    await this.db.run('CREATE TABLE IF NOT EXISTS metadata (name text, value text, PRIMARY KEY (name));');
    await this.db.run('INSERT or REPLACE INTO metadata(name, value) VALUES($name, $value);', {
      $name: 'locale',
      $value: 'en-US'
    });
    this.insertStatement = await this.db.prepare('INSERT or REPLACE INTO tiles (tile_column, tile_row, zoom_level, tile_data) VALUES ($tile_column, $tile_row, $zoom_level, $tile_data);');
  }

  addTile(tile, $tile_data) {
    return this.insertStatement.run({
      $tile_column: tile.x,
      $tile_row: tile.y,
      $zoom_level: tile.zoom,
      $tile_data
    });
  }

  async close() {
    await this.insertStatement.finalize();
    await this.db.close();
  }
}

module.exports = BasePackager;