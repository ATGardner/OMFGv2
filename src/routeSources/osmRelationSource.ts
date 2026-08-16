import type {FeatureCollection, Geometry} from 'geojson';
import osmtogeojson from 'osmtogeojson';
import type {RouteSource} from '../types.ts';
import {overpassQuery} from '../utils/index.ts';

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
    const osmJson = await overpassQuery(
      `relation(${this.relationId});(._;>;);out body meta;`,
    );
    return osmtogeojson(osmJson);
  }

  toString(): string {
    return `${this.relationId}`;
  }
}
