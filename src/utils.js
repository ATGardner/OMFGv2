const { existsSync, mkdirSync, readFileSync } = require('fs');
const { dirname, extname, normalize, resolve, relative, parse } = require('path');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const { gpx, kml } = require('@mapbox/togeojson');
const { DOMParser } = require('xmldom');
const Tile = require('./Tile');

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
      const docEntry = zipEntries.find(({ name }) => extname(name) === '.kml');
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
  const { type, coordinates } = json;
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
    case 'GeometryCollection':
      const { geometries } = json;
      for (const geometry of geometries) {
        yield* extractCoordinates(geometry);
      }

      return;
    case 'Feature':
      const { geometry } = json;
      return yield* extractCoordinates(geometry);
    case 'FeatureCollection':
      const { features } = json;
      for (const feature of features) {
        yield* extractCoordinates(feature);
      }
  }
}

function long2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)
  );
}

function coordinates2Tile([lon, lat], zoom) {
  const x = long2tile(lon, zoom);
  const y = lat2tile(lat, zoom);
  return new Tile(x, y, zoom);
}

let counter = -1;

function buildTileUrl(addressTemplate, tile) {
  return addressTemplate
    .replace(/{x}/, tile.x)
    .replace(/{y}/, tile.y)
    .replace(/{zoom}/, tile.zoom)
    .replace(/\[(.*)]/, (match, subDomains) => {
      counter = (counter + 1) % subDomains.length;
      return subDomains[counter];
    });
}

async function downloadTile(address) {
  const response = await fetch(address);
  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return response.buffer();
}

function ensurePath(filename) {
  const path = dirname(filename);
  if (!existsSync(path)) {
    mkdirSync(path);
  }
}

module.exports = {
  readGeoJson,
  extractCoordinates,
  coordinates2Tile,
  buildTileUrl,
  downloadTile,
  ensurePath
};
