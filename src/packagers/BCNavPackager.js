const { format } = require('path');
const BasePackager = require('./basePackager');

class BCNavPackager extends BasePackager {
  constructor(fileName) {
    super(format({ name: fileName, ext: '.sqlite' }));
  }

  async init() {
    await super.init();
    await this.db.run(
      'CREATE TABLE IF NOT EXISTS tiles (x int, y int, z int, s int, image blob, PRIMARY KEY (x,y,z,s));',
    );
    await this.db.run('CREATE INDEX IF NOT EXISTS IND on tiles (x, y, z, s);');
    await this.db.run('CREATE TABLE IF NOT EXISTS info (minzoom int, maxzoom int)');
    this.insertStatement = await this.db.prepare(
      'INSERT or REPLACE INTO tiles (x, y, z, s, image) VALUES ($x, $y, $z, 0, $image);',
    );
  }

  addTile({ x, y, zoom }, $image) {
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
    await this.db.run(
      'insert into info(minzoom, maxzoom) values((select min(z) from tiles), (select max(z) from tiles));',
    );
    await super.close();
  }
}

module.exports = BCNavPackager;
