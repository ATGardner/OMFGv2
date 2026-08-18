import {userAgent} from '../userAgent.ts';

async function request(query: string): Promise<unknown> {
  const body = `[out:json][timeout:25];${query}`;
  const result = await fetch('http://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
    // Same 406 as the copy of this in utils, for the same missing header.
    headers: {'User-Agent': userAgent},
  });
  if (!result.ok) {
    throw new Error(`${result.status}`);
  }

  return result.json();
}

export function fetchRelation(relationId: number): Promise<unknown> {
  return request(`relation(${relationId});(._;>;);out body meta;`);
}
