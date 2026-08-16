import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import Cache from '../src/tileSources/cache.ts';
import Tile from '../src/utils/Tile.ts';

/*
 * Written as a Buffer, because that is what a downloaded tile is, and read
 * back as a plain Uint8Array, because that is what node:sqlite returns for a
 * blob. `deepStrictEqual` compares prototypes, so the two constants are not
 * interchangeable — chai's `deep.equal` treated them as equal and hid the
 * distinction.
 */
const DATA = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
const STORED = Uint8Array.from(DATA);

describe('Cache', () => {
  it('initializes the cache database', () => {
    const cache = new Cache();
    cache.init();
  });
  it('inserts a tile to the database', () => {
    const cache = new Cache();
    const tile = new Tile(1, 2, 3);
    cache.init();
    cache.addTile(tile, DATA, new Date(), 'etag');
  });
  it('gets a tile from the database', () => {
    const cache = new Cache();
    const tile = new Tile(1, 2, 3);
    cache.init();
    const lastCheck = new Date();
    cache.addTile(tile, DATA, lastCheck, 'etag');
    assert.deepEqual(cache.getTile(tile), {
      data: STORED,
      lastCheck,
      etag: 'etag',
    });
  });
  it('updates the last_check field of a tile', () => {
    const cache = new Cache();
    const tile = new Tile(1, 2, 3);
    cache.init();
    cache.addTile(tile, DATA, new Date(), 'etag');
    const newLastCheck = new Date('2017-01-01');
    cache.updateLastCheck(tile, newLastCheck);
    assert.deepEqual(cache.getTile(tile), {
      data: STORED,
      lastCheck: newLastCheck,
      etag: 'etag',
    });
  });
  it('stores a Date and a header string interchangeably', () => {
    const cache = new Cache();
    cache.init();
    const header = 'Sun, 16 Aug 2026 13:32:46 GMT';
    cache.addTile(new Tile(4, 5, 6), DATA, header, 'etag');
    assert.deepEqual(
      cache.getTile(new Tile(4, 5, 6))?.lastCheck,
      new Date(header),
    );
  });
  /*
   * The write batch holds a transaction open until it fills or the cache is
   * closed, so a reader on the same connection has to see uncommitted rows —
   * otherwise a tile stored earlier in a job would be downloaded twice.
   */
  it('reads back tiles written inside an uncommitted batch', () => {
    const cache = new Cache();
    cache.init();
    for (let i = 0; i < 10; i += 1) {
      cache.addTile(new Tile(i, 0, 10), DATA, new Date(), 'etag');
    }

    assert.deepEqual(cache.getTile(new Tile(7, 0, 10))?.data, STORED);
  });
});
