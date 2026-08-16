import assert from 'node:assert/strict';
import {existsSync, rmdirSync} from 'node:fs';
import {afterEach, describe, it} from 'node:test';
import type {GeoJsonInput} from '../src/utils/index.ts';
import {
  buildTileUrl,
  coordinates2Tile,
  coordinates2Tiles,
  ensurePath,
  extractCoordinates,
} from '../src/utils/index.ts';
import Tile from '../src/utils/Tile.ts';

describe('Utils', () => {
  /*
   * `extractCoordinates` is a generator with a defined traversal order, so
   * these assert the exact sequence. chai's `deep.members`, which they used
   * before, ignored order and so would not have caught a reordering.
   */
  describe('extractCoordinates', () => {
    it('extracts coordinates from a Point', () => {
      const input: GeoJsonInput = {
        type: 'Point',
        coordinates: [30, 10],
      };
      assert.deepEqual([...extractCoordinates(input)], [[30, 10]]);
    });
    it('extracts coordinates from a LineString', () => {
      const input: GeoJsonInput = {
        type: 'LineString',
        coordinates: [
          [30, 10],
          [10, 30],
          [40, 40],
        ],
      };
      assert.deepEqual(
        [...extractCoordinates(input)],
        [
          [30, 10],
          [10, 30],
          [40, 40],
        ],
      );
    });
    it('extracts coordinates from a Polygon', () => {
      const input: GeoJsonInput = {
        type: 'Polygon',
        coordinates: [
          [
            [35, 10],
            [45, 45],
            [15, 40],
            [10, 20],
            [35, 10],
          ],
          [
            [20, 30],
            [35, 35],
            [30, 20],
            [20, 30],
          ],
        ],
      };
      assert.deepEqual(
        [...extractCoordinates(input)],
        [
          [35, 10],
          [45, 45],
          [15, 40],
          [10, 20],
          [35, 10],
          [20, 30],
          [35, 35],
          [30, 20],
          [20, 30],
        ],
      );
    });
    it('extracts coordinates from a MultiPoint', () => {
      const input: GeoJsonInput = {
        type: 'MultiPoint',
        coordinates: [
          [10, 40],
          [40, 30],
          [20, 20],
          [30, 10],
        ],
      };
      assert.deepEqual(
        [...extractCoordinates(input)],
        [
          [10, 40],
          [40, 30],
          [20, 20],
          [30, 10],
        ],
      );
    });
    it('extracts coordinates from a MultiLineString', () => {
      const input: GeoJsonInput = {
        type: 'MultiLineString',
        coordinates: [
          [
            [10, 10],
            [20, 20],
            [10, 40],
          ],
          [
            [40, 40],
            [30, 30],
            [40, 20],
            [30, 10],
          ],
        ],
      };
      assert.deepEqual(
        [...extractCoordinates(input)],
        [
          [10, 10],
          [20, 20],
          [10, 40],
          [40, 40],
          [30, 30],
          [40, 20],
          [30, 10],
        ],
      );
    });
    it('extracts coordinates from a MultiPolygon', () => {
      const input: GeoJsonInput = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [40, 40],
              [20, 45],
              [45, 30],
              [40, 40],
            ],
          ],
          [
            [
              [20, 35],
              [10, 30],
              [10, 10],
              [30, 5],
              [45, 20],
              [20, 35],
            ],
            [
              [30, 20],
              [20, 15],
              [20, 25],
              [30, 20],
            ],
          ],
        ],
      };
      assert.deepEqual(
        [...extractCoordinates(input)],
        [
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
        ],
      );
    });
    it('extracts coordinates from a Feature', () => {
      const input: GeoJsonInput = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [102.0, 0.5],
        },
        properties: {
          prop0: 'value0',
        },
      };
      assert.deepEqual([...extractCoordinates(input)], [[102.0, 0.5]]);
    });
    it('skips a Feature with no geometry', () => {
      const input: GeoJsonInput = {
        type: 'Feature',
        geometry: null,
        properties: null,
      };
      assert.deepEqual([...extractCoordinates(input)], []);
    });
    it('extracts coordinates from a FeatureCollection', () => {
      const input: GeoJsonInput = {
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
      assert.deepEqual(
        [...extractCoordinates(input)],
        [
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
        ],
      );
    });
  });
  describe('coordinates2Tile', () => {
    it('calculates the right tile by coordinates', () => {
      const result = coordinates2Tile([0, 17], 16);
      assert.equal(result.x, 32768);
      assert.equal(result.y, 29626);
      assert.equal(result.zoom, 16);
    });
  });
  describe('coordinates2Tiles', () => {
    it('returns the right tiles collection with the default buffer', () => {
      const tiles = [...coordinates2Tiles([34.797757, 32.110635], 16)];
      assert.deepEqual(
        tiles.map((t) => t.toString()),
        [
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
        ],
      );
    });
  });
  describe('buildTileUrl', () => {
    it('builds a proper url when given a tile', () => {
      const sourceTemplate =
        'http://a.tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      assert.equal(
        buildTileUrl(sourceTemplate, tile),
        'http://a.tile.openstreetmap.org/3/1/2.png',
      );
    });
    it('creates the 2nd address using the 2nd sub domain', () => {
      const sourceTemplate =
        'http://[ab].tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      buildTileUrl(sourceTemplate, tile);
      assert.equal(
        buildTileUrl(sourceTemplate, tile),
        'http://b.tile.openstreetmap.org/3/1/2.png',
      );
    });
    it('creates the 3rd address using the 1st sub domain', () => {
      const sourceTemplate =
        'http://[ab].tile.openstreetmap.org/{zoom}/{x}/{y}.png';
      const tile = new Tile(1, 2, 3);
      buildTileUrl(sourceTemplate, tile);
      buildTileUrl(sourceTemplate, tile);
      assert.equal(
        buildTileUrl(sourceTemplate, tile),
        'http://a.tile.openstreetmap.org/3/1/2.png',
      );
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
      assert.ok(existsSync('test-subfolder'));
    });
  });
});
