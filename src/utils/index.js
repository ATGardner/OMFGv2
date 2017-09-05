const {existsSync, mkdirSync, readFileSync} = require('fs');
// const {Agent} = require('http');
const {dirname, extname} = require('path');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const PQueue = require('p-queue');
const winston = require('winston');
const {gpx, kml} = require('@mapbox/togeojson');
const {DOMParser} = require('xmldom');
const Tile = require('./Tile');
const {LatLonEllipsoidal: LatLon} = require('geodesy');

// const HttpProxyAgent = require('http-proxy-agent');

const queue = new PQueue({concurrency: 10});

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function readDocFromFile(fileName) {
  const text = readFileSync(fileName, 'utf8');
  return new DOMParser().parseFromString(text);
}

function readGeoJson(fileName) {
  const ext = extname(fileName);
  switch (ext) {
    case '.gpx': {
      const doc = readDocFromFile(fileName);
      return gpx(doc);
    }
    case '.kml': {
      const doc = readDocFromFile(fileName);
      return kml(doc);
    }
    case '.kmz': {
      const zip = new AdmZip(fileName);
      const zipEntries = zip.getEntries();
      const docEntry = zipEntries.find(({name}) => extname(name) === '.kml');
      if (!docEntry) {
        throw new Error('KMZ file is invalid');
      }

      const kmlString = zip.readAsText(docEntry);
      const doc = new DOMParser().parseFromString(kmlString);
      return kml(doc);
    }
    default:
      throw new Error('Unrecognized file type. Use only gpx/kml files.');
  }
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

      return;
    case 'MultiPolygon':
      for (const outer of coordinates) {
        for (const inner of outer) {
          yield* inner;
        }
      }

      return;
    case 'GeometryCollection': {
      const {geometries} = json;
      for (const geometry of geometries) {
        yield* extractCoordinates(geometry);
      }

      return;
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

// const agent = new HttpProxyAgent({
//   hostname: '127.0.0.1',
//   port: '8888',
//   keepAlive: true
// });

async function downloadTile(address, etag, retry = 0) {
  const options = {
    headers: {},
    // agent
  };
  if (etag) {
    options.headers['If-None-Match'] = etag;
  }

  try {
    const response = await fetch(address, options);
    etag = response.headers.get('etag');
    const lastCheck = response.headers.get('date');
    if (response.status === 304) {
      winston.verbose(
        `etag matched, skipped getting data, address: ${address}`,
      );
      return {lastCheck, etag};
    }

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    winston.verbose(`Getting response buffer, address: ${address}`);
    const data = await response.buffer();
    winston.verbose(`Got data from server, address: ${address}`);
    return {data, lastCheck, etag};
  } catch (e) {
    if (
      (e.message === 'Fiddler - Receive Failure' || e.code === 'ECONNRESET') &&
      retry < 50
    ) {
      retry += 1;
      await delay(retry * 500);
      winston.warn(`Retrying ${address}, ${retry} attempt`);
      return downloadTile(address, etag, retry);
    }

    throw e;
  }
}

function addDownload(address, etag) {
  return queue.add(() => downloadTile(address, etag));
}

function ensurePath(filename) {
  const path = dirname(filename);
  if (existsSync(path)) {
    return existsSync(filename);
  } else {
    mkdirSync(path);
  }
}

module.exports = {
  readGeoJson,
  extractCoordinates,
  coordinates2Tile,
  coordinates2Tiles,
  buildTileUrl,
  addDownload,
  ensurePath,
};
