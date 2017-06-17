const sources = require('./sources.json');
const FSSource = require('./fsSource');
const WMTSSource = require('./wmtsSource');

module.exports = {
  getSource(sourceType, source) {
    switch (sourceType) {
      case 'WMTS':
        const sourceDescriptor = sources.find(({ Name }) => Name === source);
        if (!sourceDescriptor) {
          throw new Error(`Could not find WMTS source "${source}"`);
        }

        return new WMTSSource(sourceDescriptor);
      case 'FS':
      case 'FileSystem':
        return new FSSource(source);
    }
  }
};