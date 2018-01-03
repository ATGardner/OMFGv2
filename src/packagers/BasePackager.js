const {EOL} = require('os');
const {zip} = require('../utils');

const COPYRIGHT = `Created using OMFG (https://github.com/ATGardner/OMFGv2)${EOL}`;

class BasePackager {
  constructor(filename) {
    this.filename = filename;
  }

  init() {}

  async close(type, routeAttribution, tileAttribution) {
    tileAttribution = tileAttribution
      ? `Tiles Source: ${tileAttribution}${EOL}`
      : '';
    routeAttribution = routeAttribution
      ? `Route Source: ${routeAttribution}${EOL}`
      : '';
    const createdAt = `${new Date().toISOString()}${EOL}`;
    const copyright = `${COPYRIGHT}${tileAttribution}${routeAttribution}${createdAt}`;
    return zip(this.filename, copyright, type);
  }
}

module.exports = BasePackager;
