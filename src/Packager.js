const Database = require('./sqlite3-async');

class Packager {
  constructor(output) {
    this.output = output;
    this.db = new Database(output);

  }

  async init() {
    await this.db.init();
    await this.db.run('CREATE TABLE IF NOT EXISTS tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob, PRIMARY KEY (tile_column, tile_row, zoom_level));');
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (tile_column, tile_row, zoom_level);');
    await this.db.run('CREATE TABLE IF NOT EXISTS metadata (name text, value text, PRIMARY KEY (name));');
    await this.db.run('INSERT or REPLACE INTO metadata(name, value) VALUES($name, $value);', {
      $name: 'locale',
      $value: 'en-US'
    });
    this.insertStatemtnt = await this.db.prepare('INSERT or REPLACE INTO tiles (tile_column, tile_row, zoom_level, tile_data) VALUES ($tile_column, $tile_row, $zoom_level, $tile_data);');
  }

  addTile(tile, data) {
    this.insertStatemtnt.run({
      $tile_column: tile.x,
      $tile_row: tile.y,
      $zoom_level: tile.zoom,
      $tile_data: data
    });
  }

  async close() {
    await this.insertStatemtnt.finalize();
    await this.db.close();
  }
}

class MBTilesPackager extends Packager {

}

function getPackager(format, output) {
  switch (format){
    case 'MBTiles':
      return new MBTilesPackager(output);
    default:
      throw new Error(`Unknown format type "${format}"`);
  }
}

module.exports = {
  getPackager
};