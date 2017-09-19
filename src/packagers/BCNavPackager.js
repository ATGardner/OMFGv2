const {format} = require('path');
const BasePackager = require('./basePackager');

class BCNavPackager extends BasePackager {
  constructor(fileName) {
    super(format({name: fileName, ext: '.sqlitedb'}));
  }

  async init() {
    await super.init();
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS tiles (x int, y int, z int, s int, image blob, PRIMARY KEY (x,y,z,s));',
    );
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z, s);');
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS info (minzoom int, maxzoom int)',
    );
    this.insertStatement = await this.db.prepare(
      'INSERT OR REPLACE INTO tiles (x, y, z, s, image) VALUES ($x, $y, $z, 0, $image);',
    );
    this.selectStatement = await this.db.prepare(
      'SELECT COUNT(*) AS result FROM tiles WHERE x = $x AND y = $y and z = $z;',
    );
  }

  async hasTile({x, y, zoom}) {
    if (this.newFile) {
      return false;
    }

    const $z = 17 - zoom;
    const asd = await this.selectStatement.get({
      $x: x,
      $y: y,
      $z,
    });
    const result = asd.result;
    return result === 1;
  }

  addTile({x, y, zoom}, $image) {
    const $z = 17 - zoom;
    return this.insertStatement.run({
      $x: x,
      $y: y,
      $z,
      $image,
    });
  }

  async close() {
    await this.insertStatement.finalize();
    await this.selectStatement.finalize();
    await this.db.run(
      `DELETE FROM info;
       INSERT INTO info(minzoom, maxzoom) VALUES((SELECT MIN(z) FROM tiles), (SELECT MAX(z) FROM tiles));`,
    );
    await super.close();
  }
}

module.exports = BCNavPackager;
