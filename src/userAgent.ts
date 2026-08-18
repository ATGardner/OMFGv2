import packageJson from '../package.json' with {type: 'json'};

/*
 * Node's fetch sends no User-Agent header of its own, and both services this
 * app talks to want one: the OSM API and tile usage policies ask for an agent
 * they can identify and block by, and the Overpass instance this app used to
 * query refused an anonymous request outright with `406 Not Acceptable`.
 *
 * The Dockerfile copies package.json into the image, so the version here is
 * the one that is actually running, and release-please keeps it current
 * without anyone editing this line.
 */
export const userAgent = `OMFGv2/${packageJson.version}`;
