import {execFile} from 'child_process';
import {writeFile} from 'fs';
import {EOL} from 'os';
import {join, resolve as resolvePath} from 'path';
import {promisify} from 'util';
import type Tile from '../utils/Tile.ts';
import FSSource from './fsSource.ts';

const execFileAsync = promisify(execFile);
const writeFileAsync = promisify(writeFile);

export default class MaperitiveSource extends FSSource {
  readonly Name = 'Maperitive';

  private readonly maperitiveFolder: string;

  private readonly tilesToGenerate = new Set<Tile>();

  private maxZoom = 0;

  /*
   * Every `getTileData` call parks on this until `generateAllTiles` has run
   * the renderer once for the whole batch — Maperitive is a GUI binary driven
   * by a script file, so tiles cannot be fetched one at a time.
   */
  private readonly tcs: Promise<void>;

  private resolve!: () => void;

  constructor(maperitiveFolder: string) {
    super(join(maperitiveFolder, 'tiles'));
    this.maperitiveFolder = maperitiveFolder;
    this.tcs = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  override get id(): string {
    return this.Name;
  }

  override async getTileData(tile: Tile): Promise<Buffer | undefined> {
    const data = this.readTile(tile);
    if (data) {
      return data;
    }

    this.tilesToGenerate.add(tile);
    this.maxZoom = Math.max(this.maxZoom, tile.zoom);
    await this.tcs;
    return this.readTile(tile);
  }

  async generateAllTiles(): Promise<void> {
    const tilesToCreate = [...this.tilesToGenerate].filter(
      (t) => t.zoom === this.maxZoom,
    );
    if (tilesToCreate.length) {
      await this.createScriptInputFile(tilesToCreate);
      await this.callMaperitiveAsync();
    }

    this.resolve();
  }

  async createScriptInputFile(tilesToCreate: Tile[]): Promise<void> {
    const tileFileName = join(this.maperitiveFolder, 'tiles.txt');
    const tilesString = tilesToCreate
      .map((t) => `${t.x},${t.y},${t.zoom}`)
      .join(EOL);
    await writeFileAsync(tileFileName, tilesString);
  }

  async callMaperitiveAsync(): Promise<{stdout: string; stderr: string}> {
    /*
     * `src/sources` before, a directory that does not exist — the script sits
     * beside this file, in `src/tileSources`. Resolved against this module
     * rather than the working directory, so it is found however the app was
     * started.
     */
    const scriptFileName = resolvePath(
      import.meta.dirname,
      'omfg_tile_command.py',
    );
    const maperitiveCommandLine = join(this.maperitiveFolder, 'maperitive.exe');
    return execFileAsync(
      maperitiveCommandLine,
      [/* '-exitafter',*/ scriptFileName],
      {cwd: this.maperitiveFolder},
    );
  }
}
