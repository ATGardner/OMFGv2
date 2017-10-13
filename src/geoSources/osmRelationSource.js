const osmtogeojson = require('osmtogeojson');
const {overpassQuery} = require('../utils');

class OSMRelationSource {
  constructor(relationId) {
    this.relationId = relationId;
  }

  async getGeoJson() {
    const osmJson = await overpassQuery(
      `relation(${this.relationId});(._;>;);out body meta;`,
    );
    return osmtogeojson(osmJson);
  }

  toString() {
    return this.relationId;
  }
}

module.exports = OSMRelationSource;
