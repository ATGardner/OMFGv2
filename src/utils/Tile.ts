export default class Tile {
  readonly x: number;

  readonly y: number;

  readonly zoom: number;

  constructor(x: number, y: number, zoom: number) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
  }

  get parentTile(): Tile {
    return new Tile(this.x >> 1, this.y >> 1, this.zoom - 1);
  }

  toString(): string {
    return `${this.x}-${this.y}-${this.zoom}`;
  }
}
