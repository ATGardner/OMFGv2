import moment from 'moment';
import type {SourceDescriptor, TileSource} from '../types.ts';
import {addDownload, buildTileUrl} from '../utils/index.ts';
import type Tile from '../utils/Tile.ts';
import Cache, {type CachedTile} from './cache.ts';

export default class WMTSSource implements TileSource {
  /*
   * Copied field by field rather than `Object.assign(this, sourceDescriptor)`,
   * which spreads whatever sources.json happens to hold onto an object no type
   * can describe. These four are the ones anything reads.
   */
  readonly Name: string;

  readonly Address: string;

  readonly attribution: string;

  readonly quality?: number;

  protected readonly cache: Cache;

  constructor(sourceDescriptor: SourceDescriptor) {
    this.Name = sourceDescriptor.Name;
    this.Address = sourceDescriptor.Address;
    this.attribution = sourceDescriptor.attribution;
    this.quality = sourceDescriptor.quality;
    this.cache = new Cache(this.Name);
  }

  get id(): string {
    return `WMTS_${this.Name}`;
  }

  init(): Promise<void> {
    return this.cache.init();
  }

  async updateCache(
    tile: Tile,
    data: Uint8Array | undefined,
    lastCheck: string | null,
    etag: string | null,
  ): Promise<void> {
    if (data) {
      await this.cache.addTile(tile, data, lastCheck, etag);
    } else {
      await this.cache.updateLastCheck(tile, lastCheck);
    }
  }

  async getTileData(tile: Tile): Promise<Uint8Array | undefined> {
    const {
      data: cachedData,
      lastCheck,
      etag,
    }: Partial<CachedTile> = (await this.cache.getTile(tile)) ?? {};
    // A tile checked within the last day is served from the cache untouched.
    if (lastCheck && moment().subtract(1, 'day').isBefore(lastCheck)) {
      return cachedData;
    }

    try {
      const address = buildTileUrl(this.Address, tile);
      const {
        data,
        lastCheck: newLastCheck,
        etag: newEtag,
      } = await addDownload(address, etag);
      await this.updateCache(tile, data, newLastCheck, newEtag);
      return data ?? cachedData;
    } catch (error) {
      if (cachedData) {
        return cachedData;
      }

      throw error;
    }
  }

  close(): Promise<void> {
    return this.cache.close();
  }
}
