const BasePackager = require('./basePackager');

class BCNavPackager extends BasePackager {
  constructor(fileName, ...Packagers) {
    super();
    this.packagers = Packagers.map(P => new P(fileName));
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
