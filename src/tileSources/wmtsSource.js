const moment = require('moment');
const Cache = require('./cache');
const {buildTileUrl, addDownload} = require('../utils');

class WMTSSource {
  constructor(sourceDescriptor) {
    Object.assign(this, sourceDescriptor);
    this.cache = new Cache(this.Name);
  }

  get id() {
    return `WMTS_${this.Name}`;
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
    const {data: cachedData, lastCheck = 0, etag} =
      (await this.cache.getTile(tile)) || {};
    if (
      moment()
        .subtract(1, 'day')
        .isBefore(lastCheck)
    ) {
      // winston.verbose(`Got tile ${tile.toString()} from cache`);
      return cachedData;
    }

    const address = buildTileUrl(this.Address, tile);
    const {data, lastCheck: newLastCheck, etag: newEtag} = await addDownload(
      address,
      etag,
    );
    await this.updateCache(tile, data, newLastCheck, newEtag);
    return data || cachedData;
  }

  close() {
    return this.cache.close();
  }
}

module.exports = WMTSSource;
