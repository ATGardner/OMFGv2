import moment from 'moment';
import type {SourceDescriptor} from '../types.ts';
import type Tile from '../utils/Tile.ts';
import Cache, {type CachedTile} from './cache.ts';
import pngToJpeg from './pngToJpeg.ts';
import WMTSSource from './wmtsSource.ts';

export default class JPEGSource extends WMTSSource {
  private readonly jpegCache: Cache;

  constructor(sourceDescriptor: SourceDescriptor) {
    super(sourceDescriptor);
    this.jpegCache = new Cache(`${this.Name}-jpeg`);
  }

  override get id(): string {
    return `JPEG_${this.Name}`;
  }

  override init(): void {
    super.init();
    this.jpegCache.init();
  }

  updateJpegCache(
    tile: Tile,
    data: Uint8Array | undefined,
    lastCheck: string,
  ): void {
    if (data) {
      this.jpegCache.addTile(tile, data, lastCheck);
    } else {
      this.jpegCache.updateLastCheck(tile, lastCheck);
    }
  }

  override async getTileData(tile: Tile): Promise<Uint8Array | undefined> {
    const {data: cachedData, lastCheck}: Partial<CachedTile> =
      this.jpegCache.getTile(tile) ?? {};
    if (lastCheck && moment().subtract(1, 'day').isBefore(lastCheck)) {
      return cachedData;
    }

    const data = await super.getTileData(tile);
    if (data) {
      const jpegData = await pngToJpeg(data, this.quality);
      this.updateJpegCache(tile, jpegData, new Date().toISOString());
      return jpegData;
    }

    return cachedData;
  }

  override close(): void {
    super.close();
    this.jpegCache.close();
  }
}
