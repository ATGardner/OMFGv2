const LocalFilesSource = require('./localFilesSource');
const OsmRelationSource = require('./osmRelationSource');

module.exports = {
  getRouteSource(sourceType, data) {
    switch (sourceType) {
      case 'localFile':
        return new LocalFilesSource(data);
      case 'osmRelation':
        return new OsmRelationSource(data);
    }
  },
};
