import osmtogeojson from 'osmtogeojson';
import {overpassQuery} from '../utils/index.js';
export default class OSMRelationSource {
  constructor(relationId) {
    this.relationId = relationId;
    this.routeAttribution = `https://hiking.waymarkedtrails.org/#route?id=${relationId}`;
  }

  get id() {
    return this.relationId;
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
