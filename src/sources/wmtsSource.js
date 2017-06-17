const moment = require('moment');
const winston = require('winston');
const Cache = require('./cache');
const {buildTileUrl, downloadTile} = require('../utils');

class WMTSSource {
  constructor(sourceDescriptor) {
    Object.assign(this, sourceDescriptor);
    this.cache = new Cache(this.Name);
  }

  init() {
    return this.cache.init();
  }

  async updateCache(tile, data, lastCheck, etag) {
    if (data) {
      await this.cache.addTile(tile, data, lastCheck, etag);
    } else {
      await this.cache.updateLastCheck(tile, lastCheck);
    }
  }

  async getTileData(tile) {
    const {data, lastCheck = 0, etag} = await this.cache.getTile(tile) || {};
    if (moment().subtract(1, 'day').isBefore(lastCheck)) {
      winston.verbose(`Got tile ${tile.toString()} from cache`);
      return data;
    }

    const address = buildTileUrl(this.Address, tile);
    try {
      const {data, lastCheck: newLastCheck, etag: newEtag} = await downloadTile(address, etag);
      await this.updateCache(tile, data, newLastCheck, newEtag);
      return data;
    } catch (error) {
      winston.error(`Failed getting tile ${tile.toString()} data`, error.message);
    }
  }

  close() {
    return this.cache.close();
  }
}

module.exports = WMTSSource;