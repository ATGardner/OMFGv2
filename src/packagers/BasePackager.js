const {readFileSync, writeFileSync, unlinkSync} = require('fs');
const {EOL} = require('os');
const {parse, format} = require('path');
const JSZip = require('jszip');

const COPYRIGHT = `Created using OMFG (https://github.com/ATGardner/OMFGv2)${EOL}`;

class BasePackager {
  constructor(filename) {
    this.filename = filename;
  }

  init() {}

  async close(type, routeAttribution, tileAttribution) {
    const zip = new JSZip();
    const {dir, base, name} = parse(this.filename);
    const data = readFileSync(this.filename);
    routeAttribution = routeAttribution
      ? `Route Source: ${routeAttribution}${EOL}`
      : '';
    tileAttribution = tileAttribution
      ? `Tiles Source: ${tileAttribution}${EOL}`
      : '';
    zip.file(base, data);
    zip.file(
      'copyright.txt',
      `${COPYRIGHT}${tileAttribution}${routeAttribution}`,
    );
    const content = await zip.generateAsync({type: 'nodebuffer'});
    const zipFilename = format({dir, name: `${name} - ${type}`, ext: '.zip'});
    writeFileSync(zipFilename, content);
    unlinkSync(this.filename);
  }
}

module.exports = BasePackager;
