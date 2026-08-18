import packageJson from '../package.json' with {type: 'json'};

/*
 * Node's fetch sends no User-Agent header of its own, and both services this
 * app talks to treat that as a reason to refuse: overpass-api.de answers a
 * request without one with `406 Not Acceptable`, and the OSM tile usage policy
 * asks for an identifying agent outright. The Dockerfile copies package.json
 * into the image, so the version here is the one that is actually running, and
 * release-please keeps it current without anyone editing this line.
 */
export const userAgent = `OMFGv2/${packageJson.version}`;
