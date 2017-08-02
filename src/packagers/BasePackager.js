const Database = require('../utils/sqlite3-async');
const { ensurePath } = require('../utils');

class BasePackager {
  constructor(filename) {
    this.newFile = ensurePath(filename);
    this.db = new Database(filename);
  }

  async init() {
    await this.db.init();
  }

  async close() {
    await this.db.close();
  }
}

module.exports = BasePackager;
