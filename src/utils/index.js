const {existsSync, mkdirSync} = require('fs');
const {dirname} = require('path');
const fetch = require('node-fetch');
const PQueue = require('p-queue');
const winston = require('winston');
const Tile = require('./Tile');
const {LatLonEllipsoidal: LatLon} = require('geodesy');

const queue = new PQueue({concurrency: 10});

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function* extractCoordinates(json) {
  const {type, coordinates} = json;
  switch (type) {
    case 'Point':
      return yield coordinates;
    case 'MultiPoint':
    case 'LineString':
      return yield* coordinates;
    case 'MultiLineString':
    case 'Polygon':
      for (const c of coordinates) {
        yield* c;
      }

      return undefined;
    case 'MultiPolygon':
      for (const outer of coordinates) {
        for (const inner of outer) {
          yield* inner;
        }
      }

      return undefined;
    case 'GeometryCollection': {
      const {geometries} = json;
      for (const geometry of geometries) {
        yield* extractCoordinates(geometry);
      }

      return undefined;
    }
    case 'Feature': {
      const {geometry} = json;
      return yield* extractCoordinates(geometry);
    }
    case 'FeatureCollection': {
      const {features} = json;
      for (const feature of features) {
        yield* extractCoordinates(feature);
      }
    }
  }
}

function long2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor(
    (1 -
      Math.log(
        Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180),
      ) /
        Math.PI) /
      2 *
      Math.pow(2, zoom),
  );
}

function coordinates2Tile([lon, lat], zoom) {
  const x = long2tile(lon, zoom);
  const y = lat2tile(lat, zoom);
  return new Tile(x, y, zoom);
}

function* coordinates2Tiles([lon, lat], zoom, buffer = 1000) {
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

function buildTileUrl(addressTemplate, tile) {
  return addressTemplate
    .replace(/{x}/, tile.x)
    .replace(/{y}/, tile.y)
    .replace(/{zoom}|{z}/, tile.zoom)
    .replace(/\[(.*)]/, (match, subDomains) => {
      counter = (counter + 1) % subDomains.length;
      return subDomains[counter];
    });
}

async function downloadTile(address, etag) {
  const options = {
    headers: {},
  };
  if (etag) {
    options.headers['If-None-Match'] = etag;
  }

  const response = await fetch(address, options);
  etag = response.headers.get('etag');
  const lastCheck = response.headers.get('date');
  if (response.status === 304) {
    winston.verbose(`etag matched, skipped getting data, address: ${address}`);
    return {lastCheck, etag};
  }

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const data = await response.buffer();
  return {data, lastCheck, etag};
}

async function addDownload(address, etag, retry = 0) {
  try {
    return await queue.add(() => downloadTile(address, etag));
  } catch (error) {
    if (error.code === 'ECONNRESET' && retry < 50) {
      retry += 1;
      await delay(retry * 500);
      winston.warn(`Retrying ${address}, ${retry} attempt`);
      return addDownload(address, etag, retry);
    } else {
      throw error;
    }
  }
}

function ensurePath(filename) {
  const path = dirname(filename);
  if (existsSync(path)) {
    return existsSync(filename);
  } else {
    mkdirSync(path);
  }
}

async function overpassQuery(query) {
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

module.exports = {
  addDownload,
  extractCoordinates,
  buildTileUrl,
  coordinates2Tile,
  coordinates2Tiles,
  ensurePath,
  overpassQuery,
};
