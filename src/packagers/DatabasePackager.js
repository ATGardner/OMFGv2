const {EOL} = require('os');
const Database = require('../utils/sqlite3-async');
const {ensurePath, zip} = require('../utils');

const COPYRIGHT = `Created using OMFG (https://github.com/ATGardner/OMFGv2)${EOL}`;
class DatabasePackager {
  constructor(fileName) {
    this.fileName = fileName;
    this.newFile = !ensurePath(fileName);
    this.db = new Database(fileName);
  }

  get id() {
    return `DB_${this.fileName}`;
  }

  async init() {
    return this.db.init();
  }

  async close(type, routeAttribution, tileAttribution) {
    await this.db.close();
    tileAttribution = tileAttribution
      ? `Tiles Source: ${tileAttribution}${EOL}`
      : '';
    routeAttribution = routeAttribution
      ? `Route Source: ${routeAttribution}${EOL}`
      : '';
    const createdAt = `${new Date().toISOString()}${EOL}`;
    const copyright = `${COPYRIGHT}${tileAttribution}${routeAttribution}${createdAt}`;
    return zip(this.fileName, copyright, type);
  }
}

module.exports = DatabasePackager;
