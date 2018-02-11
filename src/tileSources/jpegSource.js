const pngToJpeg = require('png-to-jpeg');
const moment = require('moment');
const Cache = require('./cache');
const WMTSSource = require('./wmtsSource');

class JPEGSource extends WMTSSource {
  constructor(sourceDescriptor) {
    super(sourceDescriptor);
    this.jpegCache = new Cache(`${this.Name}-jpeg`);
  }

  get id() {
    return `JPEG_${this.Name}`;
  }

  async init() {
    await super.init();
    return this.jpegCache.init();
  }

  async updateJpegCache(tile, data, lastCheck) {
    if (data) {
      await this.jpegCache.addTile(tile, data, lastCheck);
    } else {
      await this.jpegCache.updateLastCheck(tile, lastCheck);
    }
  }

  async getTileData(tile) {
    const {data: cachedData, lastCheck = 0} =
      (await this.jpegCache.getTile(tile)) || {};
    if (
      moment()
        .subtract(1, 'day')
        .isBefore(lastCheck)
    ) {
      // winston.verbose(`Got jpeg tile ${tile.toString()} from cache`);
      return cachedData;
    }

    const data = await super.getTileData(tile);
    if (data) {
      const jpegData = await pngToJpeg({quality: this.quality || 50})(data);
      await this.updateJpegCache(tile, jpegData, new Date().toISOString());
      return jpegData;
    }

    return cachedData;
  }

  async close() {
    await super.close();
    return this.jpegCache.close();
  }
}

module.exports = JPEGSource;
