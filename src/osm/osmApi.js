import fetch from 'node-fetch';

async function request(query) {
  const body = `[out:json][timeout:25];${query}`;
  const result = await fetch('http://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    throw new Error(result.status);
  }

  return result.json();
}

export function fetchRelation(relationId) {
  return request(`relation(${relationId});(._;>;);out body meta;`);
}
