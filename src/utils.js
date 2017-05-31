const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');
const tj = require('@mapbox/togeojson');

function readGeoJson(fileName) {
  const text = fs.readFileSync(fileName, 'utf8');
  const doc = new DOMParser().parseFromString(text);
  return path.extname(fileName) === '.gpx' ? tj.gpx(doc) : tj.kml(doc);
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
  return { x, y, zoom };
}

module.exports = {
  readGeoJson,
  extractCoordinates,
  coordinates2Tile
};
