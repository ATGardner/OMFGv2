import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, before, describe, it} from 'node:test';
import express from 'express';
import {createOutputRouter, toDownloadUrls} from '../src/output.ts';

/*
 * A real listening server rather than a hand-rolled req/res pair, for the same
 * reason the health tests use one: what is being asserted here — the
 * Content-Disposition express writes, and the 403 send() raises on a path that
 * climbs out of the root — is entirely the framework's behaviour, and a fake
 * would only be asserting the fake.
 */
let dir = '';
let outside = '';

// The name a packager really produces: spaces, dashes and all.
const packaged = 'relation-282071 - OpenStreetMap - 10-12 - Orux.zip';
const contents = 'PK not really a zip';

async function get(path: string): Promise<Response> {
  const app = express();
  app.use(createOutputRouter({dir}));
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const {port} = server.address() as {port: number};
    return await fetch(`http://127.0.0.1:${port}${path}`);
  } finally {
    server.close();
  }
}

describe('Output', () => {
  before(async () => {
    outside = await mkdtemp(join(tmpdir(), 'omfg-output-'));
    dir = join(outside, 'output');
    await mkdir(dir);
    await writeFile(join(dir, packaged), contents);
    // Outside the served root, and named in the traversal case below.
    await writeFile(join(outside, 'secret.txt'), 'not yours');
  });

  after(async () => {
    await rm(outside, {recursive: true, force: true});
  });

  describe('GET /output/:file', () => {
    it('serves a packaged file as an attachment under its own name', async () => {
      const response = await get(`/output/${encodeURIComponent(packaged)}`);
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('content-disposition'),
        `attachment; filename="${packaged}"`,
      );
      assert.equal(await response.text(), contents);
    });

    it('is a 404 for a name nothing produced', async () => {
      const response = await get('/output/nothing.zip');
      assert.equal(response.status, 404);
    });

    /*
     * The whole reason the handler passes `root` to send() rather than joining
     * the parameter onto a path itself. Express hands `%2F` over decoded, so
     * without it this is a read of any file the process can open.
     */
    it('refuses a name that climbs out of the output directory', async () => {
      const response = await get('/output/..%2Fsecret.txt');
      assert.equal(response.status, 403);
      assert.doesNotMatch(await response.text(), /not yours/);
    });

    // `dotfiles: 'deny'` — a 403 rather than the 404 an ordinary miss gets.
    it('refuses a dotfile', async () => {
      const response = await get('/output/.hidden');
      assert.equal(response.status, 403);
    });
  });

  describe('toDownloadUrls', () => {
    it('encodes the base name of the packager path', () => {
      assert.deepEqual(toDownloadUrls('Done', `output/${packaged}`), [
        `/output/${encodeURIComponent(packaged)}`,
      ]);
    });

    // The `Both` output type, where MultiPackager returns one name per packager.
    it('maps every file of a multi-packager job', () => {
      assert.deepEqual(
        toDownloadUrls('Done', ['output/a - Orux.zip', 'output/a - BCNav.zip']),
        ['/output/a%20-%20Orux.zip', '/output/a%20-%20BCNav.zip'],
      );
    });

    /*
     * `result` is the estimated milliseconds left while a job runs and the
     * Error once it fails, so anything but Done has no file to point at.
     */
    it('offers nothing until the job is done', () => {
      assert.ok(!toDownloadUrls('Downloading', 12_345));
      assert.ok(!toDownloadUrls('Failed', new Error('boom')));
      assert.ok(!toDownloadUrls('N/A', null));
    });
  });
});
