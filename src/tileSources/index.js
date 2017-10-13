const sources = require('./sources.json');
const MaperitiveSource = require('./maperitiveSource');
const MBSource = require('./mbSource');
const FSSource = require('./fsSource');
const WMTSSource = require('./wmtsSource');

module.exports = {
  getTileSource(sourceType, source) {
    switch (sourceType) {
      case 'Maperitive':
        return new MaperitiveSource(source);
      case 'MB':
        return new MBSource(source);
      case 'FS':
        return new FSSource(source);
      case 'WMTS': {
        const sourceDescriptor = sources.find(({Name}) => Name === source);
        if (!sourceDescriptor) {
          throw new Error(`Could not find WMTS source "${source}"`);
        }

        return new WMTSSource(sourceDescriptor);
      }
    }
  },
};
