import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, describe, it} from 'node:test';
import FSSource from '../src/tileSources/fsSource.ts';
import Tile from '../src/utils/Tile.ts';

/*
 * The layout `getTileData` expects: <basePath>/<zoom>/<x>/<y>.png. It is the
 * whole contract of this source, and it used to live one method deeper — in a
 * `protected readTile` that existed for `MaperitiveSource` to call twice
 * around an await. That source is gone and the seam with it, so this pins the
 * behaviour to the source rather than to the subclass that shaped it.
 */
const base = mkdtempSync(join(tmpdir(), 'omfg-fs-'));
const DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

mkdirSync(join(base, '3', '1'), {recursive: true});
writeFileSync(join(base, '3', '1', '2.png'), DATA);

after(() => {
  rmSync(base, {recursive: true, force: true});
});

describe('FSSource', () => {
  it('reads a tile from <base>/<zoom>/<x>/<y>.png', () => {
    const source = new FSSource(base);
    source.init();
    assert.deepEqual(source.getTileData(new Tile(1, 2, 3)), DATA);
  });

  /*
   * A missing tile is not an error — `DownloadJob` counts an undefined result
   * as a failed tile and carries on with the rest of the route.
   */
  it('returns nothing for a tile that is not on disk', () => {
    const source = new FSSource(base);
    assert.ok(!source.getTileData(new Tile(9, 9, 9)));
  });

  it('identifies itself by its base path', () => {
    assert.equal(new FSSource(base).id, `FS_${base}`);
  });
});
