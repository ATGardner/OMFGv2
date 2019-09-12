import {fetchRelation} from './osmApi.js';
import osmtogeojson from 'osmtogeojson';
export async function getFullRelation(relationId) {
  const osmJson = await fetchRelation(relationId);
  return osmtogeojson(osmJson);
}
