export default class Tile {
  constructor(x, y, zoom) {
    this._x = x;
    this._y = y;
    this._zoom = zoom;
  }

  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }

  get zoom() {
    return this._zoom;
  }

  get parentTile() {
    return new Tile(this.x >> 1, this.y >> 1, this.zoom - 1);
  }

  toString() {
    return `${this._x}-${this._y}-${this._zoom}`;
  }
}
