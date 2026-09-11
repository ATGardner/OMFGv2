import type {FeatureCollection, Geometry} from 'geojson';
import osm2geojson from 'osm2geojson-lite';
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
    /*
     * `completeFeature` returns a FeatureCollection rather than a bare
     * geometry; `renderTagged` with `excludeWay: false` keeps the tagged
     * member ways as features of their own alongside the merged relation,
     * which is the set osmtogeojson produced with no options. Only
     * `extractCoordinates` reads this, so the duplication between the relation
     * and its ways costs a second pass over the same points and no tiles.
     */
    return osm2geojson(osmJson, {
      completeFeature: true,
      renderTagged: true,
      excludeWay: false,
    });
  }

  toString(): string {
    return `${this.relationId}`;
  }
}
