async function request(query: string): Promise<unknown> {
  const body = `[out:json][timeout:25];${query}`;
  const result = await fetch('http://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    throw new Error(`${result.status}`);
  }

  return result.json();
}

export function fetchRelation(relationId: number): Promise<unknown> {
  return request(`relation(${relationId});(._;>;);out body meta;`);
}
