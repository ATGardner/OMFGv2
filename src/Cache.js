const Database = require('./sqlite3-async');

class Cache {
  constructor(filename) {
    this.db = new Database(filename);
  }

  async init() {
    await this.db.init();
    await this.db.run('CREATE TABLE IF NOT EXISTS tiles (tile_column integer, tile_row integer, zoom_level integer, tile_data blob, last_check DATETIME, etag text, PRIMARY KEY (tile_column, tile_row, zoom_level));');
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (tile_column, tile_row, zoom_level);');
    this.insertStatement = await this.db.prepare('INSERT or REPLACE INTO tiles (tile_column, tile_row, zoom_level, tile_data, last_check, etag) VALUES ($tile_column, $tile_row, $zoom_level, $tile_data, $last_check, $etag);');
    this.updateLastCheckStatement = await this.db.prepare('UPDATE tiles SET last_check = $last_check where tile_column = $tile_column AND tile_row = $tile_row AND zoom_level = $zoom_level;');
    this.selectStatement = await this.db.prepare('SELECT tile_data, last_check, etag FROM tiles WHERE tile_column = $tile_column AND tile_row = $tile_row AND zoom_level = $zoom_level;');
  }

  addTile(tile, $tile_data, $last_check, $etag) {
    return this.insertStatement.run({
      $tile_column: tile.x,
      $tile_row: tile.y,
      $zoom_level: tile.zoom,
      $tile_data,
      $last_check: $last_check,
      $etag
    });
  }

  updateLastCheck(tile, $last_check) {
    return this.updateLastCheckStatement.run({
      $last_check: $last_check,
      $tile_column: tile.x,
      $tile_row: tile.y,
      $zoom_level: tile.zoom
    });
  }

  async getTile(tile) {
    const row = await this.selectStatement.get({
      $tile_column: tile.x,
      $tile_row: tile.y,
      $zoom_level: tile.zoom
    });
    if (row) {
      row.last_check = new Date(row.last_check);
    }

    return row;
  }

  async close() {
    await this.insertStatement.finalize();
    await this.selectStatement.finalize();
    await this.db.close();
  }
}

module.exports = Cache;