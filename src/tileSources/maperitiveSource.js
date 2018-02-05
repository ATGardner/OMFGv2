const {execFile} = require('child_process');
const {writeFile} = require('fs');
const {EOL} = require('os');
const {join, resolve} = require('path');
const {promisify} = require('util');
const FSSource = require('./fsSource');

const execFileAsync = promisify(execFile);
const writeFileAsync = promisify(writeFile);
class MaperitiveSource extends FSSource {
  constructor(maperitiveFolder) {
    super(join(maperitiveFolder, 'tiles'));
    this.Name = 'Maperitive';
    this.maperitiveFolder = maperitiveFolder;
    this.tilesToGenerate = new Set();
    this.maxZoom = 0;
    this.tcs = new Promise(resolve => {
      this.resolve = resolve;
    });
  }

  async getTileData(tile) {
    const data = super.getTileData(tile);
    if (data) {
      return data;
    }

    this.tilesToGenerate.add(tile);
    this.maxZoom = Math.max(this.maxZoom, tile.zoom);
    await this.tcs;
    return super.getTileData(tile);
  }

  async generateAllTiles() {
    const tilesToCreate = [...this.tilesToGenerate].filter(
      t => t.zoom === this.maxZoom,
    );
    if (tilesToCreate.length) {
      await this.createScriptInputFile(tilesToCreate);
      await this.callMaperitiveAsync();
    }

    this.resolve();
  }

  async createScriptInputFile(tilesToCreate) {
    const tileFilename = join(this.maperitiveFolder, 'tiles.txt');
    const tilesString = tilesToCreate
      .map(t => `${t.x},${t.y},${t.zoom}`)
      .join(EOL);
    await writeFileAsync(tileFilename, tilesString);
  }

  async callMaperitiveAsync() {
    const scriptFilename = resolve('src', 'sources', 'omfg_tile_command.py');
    const maperitiveCommandLine = join(this.maperitiveFolder, 'maperitive.exe');
    return execFileAsync(
      maperitiveCommandLine,
      [/* '-exitafter',*/ scriptFilename],
      {cwd: this.maperitiveFolder},
    );
  }
}

module.exports = MaperitiveSource;
