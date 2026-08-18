import type {FeatureCollection, Geometry} from 'geojson';
import osmtogeojson from 'osmtogeojson';
import {fetchRelation} from '../osm/osmApi.ts';
import type {RouteSource} from '../types.ts';

export default class OSMRelationSource implements RouteSource {
  private readonly relationId: number;

  readonly routeAttribution: string;

  constructor(relationId: number) {
    this.relationId = relationId;
    this.routeAttribution = `https://hiking.waymarkedtrails.org/#route?id=${relationId}`;
  }

  get id(): string {
    return `${this.relationId}`;
  }

  async getGeoJson(): Promise<FeatureCollection<Geometry | null>> {
    const osmJson = await fetchRelation(this.relationId);
    return osmtogeojson(osmJson);
  }

  toString(): string {
    return `${this.relationId}`;
  }
}
