import crypto from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import {dirname, format, parse} from 'path';
import {setTimeout as setTimeoutAsync} from 'timers/promises';
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js';
import type {Feature, FeatureCollection, Geometry, Position} from 'geojson';
import JSZip from 'jszip';
import PQueue from 'p-queue';
import DownloadError from './DownloadError.ts';
import {getLogger} from './logging.ts';
import Tile from './Tile.ts';

const logger = getLogger('utils/index.ts');
const queue = new PQueue({concurrency: 10});

/*
 * Spelled out rather than `GeoJSON<Geometry | null>`, whose union includes a
 * bare `null` — that alone stops the `switch` below from discriminating on
 * `.type`. The nullable geometry is what the route sources actually produce:
 * `@tmcw/togeojson`'s `kml` is typed `FeatureCollection<Geometry | null>`,
 * since a KML Placemark need not have one.
 */
export type GeoJsonInput =
  Geometry | Feature<Geometry | null> | FeatureCollection<Geometry | null>;

export function* extractCoordinates(json: GeoJsonInput): Generator<Position> {
  switch (json.type) {
    case 'Point':
      yield json.coordinates;
      return;
    case 'MultiPoint':
    case 'LineString':
      yield* json.coordinates;
      return;
    case 'MultiLineString':
    case 'Polygon':
      for (const c of json.coordinates) {
        yield* c;
      }

      return;
    case 'MultiPolygon':
      for (const outer of json.coordinates) {
        for (const inner of outer) {
          yield* inner;
        }
      }

      return;
    case 'GeometryCollection':
      for (const geometry of json.geometries) {
        yield* extractCoordinates(geometry);
      }

      return;
    case 'Feature':
      /*
       * A Feature is allowed a null geometry, and `@tmcw/togeojson` emits one
       * for a KML Placemark with no Point/LineString. Recursing into it used
       * to read `.type` off null.
       */
      if (json.geometry) {
        yield* extractCoordinates(json.geometry);
      }

      return;
    case 'FeatureCollection':
      for (const feature of json.features) {
        yield* extractCoordinates(feature);
      }
  }
}

export function generateId(...parts: (string | number)[]): string {
  const data = parts.join();
  return crypto.createHash('md5').update(data).digest('hex');
}

function long2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );
}

export function coordinates2Tile([lon, lat]: Position, zoom: number): Tile {
  const x = long2tile(lon, zoom);
  const y = lat2tile(lat, zoom);
  return new Tile(x, y, zoom);
}

export function* coordinates2Tiles(
  [lon, lat]: Position,
  zoom: number,
  buffer = 1000,
): Generator<Tile> {
  const center = new LatLon(lat, lon);
  const nw = center.destinationPoint(buffer, 315);
  const nwX = long2tile(nw.lon, zoom);
  const nwY = lat2tile(nw.lat, zoom);
  const se = center.destinationPoint(buffer, 135);
  const seX = long2tile(se.lon, zoom);
  const seY = lat2tile(se.lat, zoom);
  for (let x = nwX; x <= seX; x += 1) {
    for (let y = nwY; y <= seY; y += 1) {
      yield new Tile(x, y, zoom);
    }
  }
}

let counter = -1;

export function buildTileUrl(addressTemplate: string, tile: Tile): string {
  return addressTemplate
    .replace(/{x}/, `${tile.x}`)
    .replace(/{y}/, `${tile.y}`)
    .replace(/{zoom}|{z}/, `${tile.zoom}`)
    .replace(/\[(.*)]/, (_match, subDomains: string) => {
      counter = (counter + 1) % subDomains.length;
      return subDomains[counter];
    });
}

export interface DownloadResult {
  data?: Buffer;
  lastCheck: string | null;
  etag: string | null;
}

async function downloadTile(
  address: string,
  etag?: string,
): Promise<DownloadResult> {
  const headers: Record<string, string> = {};
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await fetch(address, {headers});
  const newEtag = response.headers.get('etag');
  const lastCheck = response.headers.get('date');
  if (response.status === 304) {
    logger.verbose(`etag matched, skipped getting data, address: ${address}`);
    return {lastCheck, etag: newEtag};
  }

  if (!response.ok) {
    throw new DownloadError(response.status, response.statusText);
  }

  /*
   * `response.buffer()` was node-fetch's; the global fetch this now uses is
   * spec-shaped, so the bytes come back as an ArrayBuffer. sqlite3 binds a
   * Buffer as a blob, hence the wrap rather than a bare Uint8Array.
   */
  const data = Buffer.from(await response.arrayBuffer());
  return {data, lastCheck, etag: newEtag};
}

/*
 * A connection-level failure from the global fetch arrives as a bare
 * `TypeError: fetch failed` with the useful error hanging off `cause` — the
 * codes the retry below keys on are one level down from where node-fetch put
 * them.
 */
function getErrorCode(error: unknown): string | number | undefined {
  if (error instanceof DownloadError) {
    return error.code;
  }

  if (error instanceof Error) {
    const {code} = error as {code?: string | number};
    if (code !== undefined) {
      return code;
    }

    return getErrorCode(error.cause);
  }

  return undefined;
}

export async function addDownload(
  address: string,
  etag?: string,
  retry = 0,
): Promise<DownloadResult> {
  try {
    return await queue.add(() => downloadTile(address, etag));
  } catch (error) {
    const code = getErrorCode(error);
    const shouldRetry =
      !etag &&
      (code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 503);
    if (shouldRetry && retry < 15) {
      const timeout = 1000 * Math.min(2 ** retry, 60);
      await setTimeoutAsync(timeout);
      logger.warn(
        `Retrying ${address}, after waiting ${timeout}ms, ${retry} attempt`,
      );
      return addDownload(address, etag, retry + 1);
    }

    logger.error(`Failed downloading ${address}, code: ${code}`, error);
    throw error;
  }
}

/*
 * Answers "did this file already exist", creating its directory on the way if
 * it did not. The packagers read the result as "is this a brand new file", and
 * skip their `hasTile` lookups entirely when it is.
 */
export function ensurePath(fileName: string): boolean {
  const path = dirname(fileName);
  if (existsSync(path)) {
    return existsSync(fileName);
  }

  mkdirSync(path, {recursive: true});
  return false;
}

export async function overpassQuery(query: string): Promise<unknown> {
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

export async function zip(
  fileName: string,
  copyright: string,
  type: string,
): Promise<string> {
  const archive = new JSZip();
  const {dir, base, name} = parse(fileName);
  const data = readFileSync(fileName);
  archive.file(base, data);
  archive.file('copyright.txt', copyright);
  let done = 0;
  const content = await archive.generateAsync(
    {
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
      comment: copyright,
    },
    ({percent}) => {
      const rounded = +percent.toFixed(0);
      if (rounded > done) {
        done = rounded;
        logger.verbose(`Zip progression: ${rounded} %`);
      }
    },
  );
  const zipFileName = format({dir, name: `${name} - ${type}`, ext: '.zip'});
  writeFileSync(zipFileName, content);
  unlinkSync(fileName);
  return zipFileName;
}
