const {existsSync, rmdirSync} = require('fs');
const chai = require('chai');
const chaiString = require('chai-string');
const {
  extractCoordinates,
  coordinates2Tile,
  coordinates2Tiles,
  buildTileUrl,
  ensurePath,
} = require('../src/utils');
const Tile = require('../src/utils/Tile');

chai.use(chaiString);
const {expect} = chai;

describe('Utils', () => {
  describe('extractCoordinates', () => {
    it('extracts coordinates from a Point', () => {
      const input = {
        type: 'Point',
        coordinates: [30, 10],
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[30, 10]]);
    });

    it('extracts coordinates from a LineString', () => {
      const input = {
        type: 'LineString',
        coordinates: [[30, 10], [10, 30], [40, 40]],
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([[30, 10], [10, 30], [40, 40]]);
    });

    it('extracts coordinates from a Polygon', () => {
      const input = {
        type: 'Polygon',
        coordinates: [
          [[35, 10], [45, 45], [15, 40], [10, 20], [35, 10]],
          [[20, 30], [35, 35], [30, 20], [20, 30]],
        ],
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
        [20, 30],
      ]);
    });

    it('extracts coordinates from a MultiPoint', () => {
      const input = {
        type: 'MultiPoint',
        coordinates: [[10, 40], [40, 30], [20, 20], [30, 10]],
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([
        [10, 40],
        [40, 30],
        [20, 20],
        [30, 10],
      ]);
    });

    it('extracts coordinates from a MultiLineString', () => {
      const input = {
        type: 'MultiLineString',
        coordinates: [
          [[10, 10], [20, 20], [10, 40]],
          [[40, 40], [30, 30], [40, 20], [30, 10]],
        ],
      };
      const output = [...extractCoordinates(input)];
      expect(output).to.have.deep.members([
        [10, 10],
        [20, 20],
        [10, 40],
        [40, 40],
        [30, 30],
        [40, 20],
        [30, 10],
      ]);
    });

    it('extracts coordinates from a MultiPolygon', () => {
      const input = {
        type: 'MultiPolygon',
        coordinates: [
          [[[40, 40], [20, 45], [45, 30], [40, 40]]],
          [
            [[20, 35], [10, 30], [10, 10], [30, 5], [45, 20], [20, 35]],
            [[30, 20], [20, 15], [20, 25], [30, 20]],
          ],
        ],
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
        [30, 20],
      ]);
    });

    it('extracts coordinates from a Feature', () => {
      const input = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [102.0, 0.5],
        },
        properties: {
          prop0: 'value0',
        },
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
              coordinates: [102.0, 0.5],
            },
            properties: {
              prop0: 'value0',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [102.0, 0.0],
                [103.0, 1.0],
                [104.0, 0.0],
                [105.0, 1.0],
              ],
            },
            properties: {
              prop0: 'value0',
              prop1: 0.0,
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [100.0, 0.0],
                  [101.0, 0.0],
                  [101.0, 1.0],
                  [100.0, 1.0],
                  [100.0, 0.0],
                ],
              ],
            },
            properties: {
              prop0: 'value0',
              prop1: {this: 'that'},
            },
          },
        ],
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
        [100.0, 0.0],
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

  describe('coordinates2Tiles', () => {
    it('returns the right tiles collection with the default buffer', () => {
      const coordinates = [34.797757, 32.110635];
      const tiles = [...coordinates2Tiles(coordinates, 16)];
      const result = tiles.map(t => t.toString());
      expect(result).to.deep.equal([
        '39101-26588-16',
        '39101-26589-16',
        '39101-26590-16',
        '39101-26591-16',
        '39102-26588-16',
        '39102-26589-16',
        '39102-26590-16',
        '39102-26591-16',
        '39103-26588-16',
        '39103-26589-16',
        '39103-26590-16',
        '39103-26591-16',
        '39104-26588-16',
        '39104-26589-16',
        '39104-26590-16',
        '39104-26591-16',
      ]);
    });
  });

  describe('buildTileUrl', () => {
    it('builds a proper url when given a tile', () => {
      const sourceTemplate =
        'http://a.tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      const result = buildTileUrl(sourceTemplate, tile);
      expect(result).to.equal('http://a.tile.openstreetmap.org/3/1/2.png');
    });

    it('creates the 2nd address using the 2nd sub domain', () => {
      const sourceTemplate =
        'http://[ab].tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      buildTileUrl(sourceTemplate, tile);
      const result = buildTileUrl(sourceTemplate, tile);
      expect(result).to.equal('http://b.tile.openstreetmap.org/3/1/2.png');
    });

    it('creates the 3rd address using the 1st sub domain', () => {
      const sourceTemplate =
        'http://[ab].tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      buildTileUrl(sourceTemplate, tile);
      buildTileUrl(sourceTemplate, tile);
      const result = buildTileUrl(sourceTemplate, tile);
      expect(result).to.equal('http://a.tile.openstreetmap.org/3/1/2.png');
    });
  });

  describe('ensurePath', () => {
    afterEach(() => {
      if (existsSync('test-subfolder')) {
        rmdirSync('test-subfolder');
      }
    });

    it('does not throw on existing folders', () => {
      ensurePath('../test');
    });

    it('creates a new sub folder', () => {
      ensurePath('test-subfolder/somefile');
      const exists = existsSync('test-subfolder');
      expect(exists).to.be.true;
    });
  });
});
