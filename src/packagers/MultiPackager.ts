import type {Packager, TileSource} from '../types.ts';
import type Tile from '../utils/Tile.ts';

type PackagerConstructor = new (fileName: string) => Packager;

export default class MultiPackager implements Packager {
  private readonly packagers: Packager[];

  constructor(fileName: string, ...Packagers: PackagerConstructor[]) {
    this.packagers = Packagers.map((P) => new P(fileName));
  }

  get id(): string {
    const [first] = this.fileName;
    return `Multi_${first}`;
  }

  get fileName(): string[] {
    return this.packagers.flatMap((p) => p.fileName);
  }

  async init(source: TileSource): Promise<void> {
    await Promise.all(this.packagers.map((p) => p.init(source)));
  }

  /*
   * Only the first packager is asked. They are written in lockstep, so a tile
   * missing from one is missing from all — and answering "yes" from any one of
   * them would skip the download the others still need.
   */
  hasTile(tile: Tile): Promise<boolean> {
    return this.packagers[0].hasTile(tile);
  }

  async addTile(tile: Tile, data: Buffer): Promise<void> {
    await Promise.all(this.packagers.map((p) => p.addTile(tile, data)));
  }

  async close(
    routeAttribution?: string,
    tileAttribution?: string,
  ): Promise<string[]> {
    const results = await Promise.all(
      this.packagers.map((p) => p.close(routeAttribution, tileAttribution)),
    );
    return results.flat();
  }
}
