import type {FeatureCollection, Geometry} from 'geojson';
import osmtogeojson from 'osmtogeojson';
import {fetchRelation} from './osmApi.ts';

export async function getFullRelation(
  relationId: number,
): Promise<FeatureCollection<Geometry | null>> {
  const osmJson = await fetchRelation(relationId);
  return osmtogeojson(osmJson);
}
