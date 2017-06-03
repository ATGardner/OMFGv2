const chai = require('chai');
const chaiString = require('chai-string');
const {readGeoJson, extractCoordinates, coordinates2Tile, buildTileUrl} = require('../src/utils');
const Tile = require('../src/Tile');

chai.use(chaiString);
const {expect} = chai;

describe('Utils', () => {
  describe('readGeoJson', () => {
    function testReadGeoJson(input) {
      const json = readGeoJson(input);
      expect(json).to.exist;
      expect(json).to.have.property('type');
    }

    it('reads GeoJson from gpx file', () => {
      const input = 'test/inputs/simple.gpx';
      testReadGeoJson(input);
    });

    it('reads GeoJson from kml file', () => {
      const input = 'test/inputs/simple.kml';
      testReadGeoJson(input);
    });

    it('reads GeoJson from kmz file', () => {
      const input = 'test/inputs/simple.kmz';
      testReadGeoJson(input);
    });

    it('throws when trying to read an unrecognized file type', done => {
      try {
        const input = 'test/inputs/simple.xxx';
        testReadGeoJson(input);
        done(new Error('File type "xxx" is not recognizable'));
      } catch (error) {
        expect(error).to.have.property('message', 'Unrecognized file type. Use only gpx/kml files.');
        done();
      }
    });

    it('throws when trying to read a non-existing file', done => {
      try {
        const input = 'test/inputs/non-existing.gpx';
        testReadGeoJson(input);
        done(new Error('File does not exist'));
      } catch (error) {
        expect(error.message).to.startWith('ENOENT: no such file or directory');
        done();
      }
    });
  });

  describe('extractCoordinates', () => {
    it('extracts coordinates from a Point', () => {
      const input = {
        type: 'Point',
        coordinates: [30, 10]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[30, 10]]);
    });

    it('extracts coordinates from a LineString', () => {
      const input = {
        type: 'LineString',
        coordinates: [[30, 10], [10, 30], [40, 40]]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[30, 10], [10, 30], [40, 40]]);
    });

    it('extracts coordinates from a Polygon', () => {
      const input = {
        type: 'Polygon',
        coordinates: [[[35, 10], [45, 45], [15, 40], [10, 20], [35, 10]], [[20, 30], [35, 35], [30, 20], [20, 30]]]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([
        [35, 10],
        [45, 45],
        [15, 40],
        [10, 20],
        [35, 10],
        [20, 30],
        [35, 35],
        [30, 20],
        [20, 30]
      ]);
    });

    it('extracts coordinates from a MultiPoint', () => {
      const input = {
        type: 'MultiPoint',
        coordinates: [[10, 40], [40, 30], [20, 20], [30, 10]]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[10, 40], [40, 30], [20, 20], [30, 10]]);
    });

    it('extracts coordinates from a MultiLineString', () => {
      const input = {
        type: 'MultiLineString',
        coordinates: [[[10, 10], [20, 20], [10, 40]], [[40, 40], [30, 30], [40, 20], [30, 10]]]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[10, 10], [20, 20], [10, 40], [40, 40], [30, 30], [40, 20], [30, 10]]);
    });

    it('extracts coordinates from a MultiPolygon', () => {
      const input = {
        type: 'MultiPolygon',
        coordinates: [
          [[[40, 40], [20, 45], [45, 30], [40, 40]]],
          [[[20, 35], [10, 30], [10, 10], [30, 5], [45, 20], [20, 35]], [[30, 20], [20, 15], [20, 25], [30, 20]]]
        ]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([
        [40, 40],
        [20, 45],
        [45, 30],
        [40, 40],
        [20, 35],
        [10, 30],
        [10, 10],
        [30, 5],
        [45, 20],
        [20, 35],
        [30, 20],
        [20, 15],
        [20, 25],
        [30, 20]
      ]);
    });

    it('extracts coordinates from a Feature', () => {
      const input = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [102.0, 0.5]
        },
        properties: {
          prop0: 'value0'
        }
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[102.0, 0.5]]);
    });

    it('extracts coordinates from a FeatureCollection', () => {
      const input = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [102.0, 0.5]
            },
            properties: {
              prop0: 'value0'
            }
          },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[102.0, 0.0], [103.0, 1.0], [104.0, 0.0], [105.0, 1.0]]
            },
            properties: {
              prop0: 'value0',
              prop1: 0.0
            }
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]]]
            },
            properties: {
              prop0: 'value0',
              prop1: {this: 'that'}
            }
          }
        ]
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([
        [102.0, 0.5],
        [102.0, 0.0],
        [103.0, 1.0],
        [104.0, 0.0],
        [105.0, 1.0],
        [100.0, 0.0],
        [101.0, 0.0],
        [101.0, 1.0],
        [100.0, 1.0],
        [100.0, 0.0]
      ]);
    });
  });

  describe('coordinates2Tile', () => {
    it('calculates the right tile by coordinates', () => {
      const input = [0, 17];
      const result = coordinates2Tile(input, 16);
      expect(result).to.have.property('x', 32768);
      expect(result).to.have.property('y', 29626);
      expect(result).to.have.property('zoom', 16);
    });
  });

  describe('buildTileUrl', () => {
    it('builds a proper url when given a tile', () => {
      const sourceTemplate = 'http://a.tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      const result = buildTileUrl(sourceTemplate, tile);
      expect(result).to.equal('http://a.tile.openstreetmap.org/3/1/2.png')
    });

    it('creates the 2nd address using the 2nd sub domain', () => {
      const sourceTemplate = 'http://[ab].tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      buildTileUrl(sourceTemplate, tile);
      const result = buildTileUrl(sourceTemplate, tile);
      expect(result).to.equal('http://b.tile.openstreetmap.org/3/1/2.png')
    });

    it('creates the 3rd address using the 1st sub domain', () => {
      const sourceTemplate = 'http://[ab].tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      buildTileUrl(sourceTemplate, tile);
      buildTileUrl(sourceTemplate, tile);
      const result = buildTileUrl(sourceTemplate, tile);
      expect(result).to.equal('http://a.tile.openstreetmap.org/3/1/2.png')
    });
  });
});
