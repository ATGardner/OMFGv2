const { format } = require('path');
const BasePackager = require('./basePackager');

class MBTilesPackager extends BasePackager {
  constructor(fileName) {
    super(format({ name: fileName, ext: '.mbtiles' }));
  }

  async init() {
    await super.init();
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS tiles (tile_column integer, tile_row integer, zoom_level integer, tile_data blob, PRIMARY KEY (tile_column, tile_row, zoom_level));',
    );
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (tile_column, tile_row, zoom_level);');
    await this.db.run('CREATE TABLE IF NOT EXISTS metadata (name text, value text, PRIMARY KEY (name));');
    this.metadataStatement = await this.db.prepare(
      'INSERT or REPLACE INTO metadata(name, value) VALUES($name, $value);',
    );
    this.insertStatement = await this.db.prepare(
      'INSERT or REPLACE INTO tiles (tile_column, tile_row, zoom_level, tile_data) VALUES ($tile_column, $tile_row, $zoom_level, $tile_data);',
    );
    await this.setMetadata('locale', 'en-US');
  }

  addTile({x, y, zoom}, $tile_data) {
    const $tile_row = (1 << zoom) - y - 1;
    return this.insertStatement.run({
      $tile_column: x,
      $tile_row,
      $zoom_level: zoom,
      $tile_data,
    });
  }

  setMetadata($name, $value) {
    return this.metadataStatement.run({
      $name,
      $value,
    });
  }

  async close() {
    await this.insertStatement.finalize();
    await this.metadataStatement.finalize();
    await super.close();
  }
}

module.exports = MBTilesPackager;