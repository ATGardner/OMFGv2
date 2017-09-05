const chai = require('chai');
const chaiString = require('chai-string');
const Cache = require('../src/sources/cache');
const Tile = require('../src/utils/Tile');

chai.use(chaiString);
const {expect} = chai;

describe('Cache', () => {
  it('initializes the cache database', () => {
    const cache = new Cache();
    return cache.init();
  });

  it('inserts a tile to the database', async () => {
    const cache = new Cache();
    const tile = new Tile(1, 2, 3);
    await cache.init();
    const data = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
    return cache.addTile(tile, data, new Date(), 'etag');
  });

  it('gets a tile from the database', async () => {
    const cache = new Cache();
    const tile = new Tile(1, 2, 3);
    await cache.init();
    const data = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
    const lastCheck = new Date();
    const etag = 'etag';
    await cache.addTile(tile, data, lastCheck, etag);
    const result = await cache.getTile(tile);
    expect(result).to.deep.equal({
      data,
      lastCheck,
      etag,
    });
  });

  it('updates the last_check field of a tile', async () => {
    const cache = new Cache();
    const tile = new Tile(1, 2, 3);
    await cache.init();
    const data = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
    const lastCheck = new Date();
    const etag = 'etag';
    await cache.addTile(tile, data, lastCheck, etag);
    const newLastCheck = new Date('2017-01-01');
    await cache.updateLastCheck(tile, newLastCheck);
    const result = await cache.getTile(tile);
    expect(result).to.deep.equal({
      data,
      lastCheck: newLastCheck,
      etag,
    });
  });
});
