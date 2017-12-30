const BasePackager = require('./BasePackager');
const Database = require('../utils/sqlite3-async');
const {ensurePath} = require('../utils');

class DatabasePackager extends BasePackager {
  constructor(filename) {
    super(filename);
    this.newFile = !ensurePath(filename);
    this.db = new Database(filename);
  }

  async init(...args) {
    await super.init(...args);
    return this.db.init();
  }

  async close(...args) {
    await this.db.close();
    return super.close(...args);
  }
}

module.exports = DatabasePackager;
