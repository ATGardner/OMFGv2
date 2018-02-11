class BCNavPackager {
  constructor(fileName, ...Packagers) {
    this.packagers = Packagers.map(P => new P(fileName));
  }

  get id() {
    return `Multi_${this.packagers[0].fileName}`;
  }

  get fileName() {
    return this.packagers.map(p => p.fileName);
  }

  init(...args) {
    return Promise.all(this.packagers.map(p => p.init(...args)));
  }

  hasTile({x, y, zoom}) {
    return this.packagers[0].hasTile({x, y, zoom});
  }

  addTile({x, y, zoom}, $image) {
    return Promise.all(
      this.packagers.map(p => p.addTile({x, y, zoom}, $image)),
    );
  }

  close(...args) {
    return Promise.all(this.packagers.map(p => p.close(...args)));
  }
}

module.exports = BCNavPackager;
