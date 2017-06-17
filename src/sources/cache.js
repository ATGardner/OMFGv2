const { join } = require('path');
const Database = require('../utils/sqlite3-async');

class Cache {
  constructor(filename) {
    if (filename) {
     filename = join('cache', filename);
    }

    this.db = new Database(filename);
  }

  async init() {
    await this.db.init();
    await this.db.run('CREATE TABLE IF NOT EXISTS tiles (x integer, y integer, z integer, data blob, last_check DATETIME, etag text, PRIMARY KEY (x, y, z));');
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z);');
    this.insertStatement = await this.db.prepare('INSERT or REPLACE INTO tiles (x, y, z, data, last_check, etag) VALUES ($x, $y, $z, $data, $last_check, $etag);');
    this.updateLastCheckStatement = await this.db.prepare('UPDATE tiles SET last_check = $last_check where x = $x AND y = $y AND z = $z;');
    this.selectStatement = await this.db.prepare('SELECT data, last_check, etag FROM tiles WHERE x = $x AND y = $y AND z = $z;');
  }

  addTile(tile, data, lastCheck, etag) {
    return this.insertStatement.run({
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom,
      $data: data,
      $last_check: lastCheck,
      $etag: etag
    });
  }

  updateLastCheck(tile, lastCheck) {
    return this.updateLastCheckStatement.run({
      $last_check: lastCheck,
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom
    });
  }

  async getTile(tile) {
    const row = await this.selectStatement.get({
      $x: tile.x,
      $y: tile.y,
      $z: tile.zoom
    });
    if (row) {
      return {
        data: row.data,
        lastCheck: new Date(row.last_check),
        etag: row.etag
      };
    }
  }

  async close() {
    await this.insertStatement.finalize();
    await this.selectStatement.finalize();
    await this.db.close();
  }
}

module.exports = Cache;