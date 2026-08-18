import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {describe, it} from 'node:test';
import {userAgent} from '../src/userAgent.ts';
import {addDownload} from '../src/utils/index.ts';

/*
 * The bug this guards against is a header that is absent, which no unit test
 * of a pure function can see — so the assertion is made against a real server
 * that reports back what it was actually sent.
 */
async function capturedUserAgent(): Promise<string> {
  /*
   * Empty rather than unset, so a header that never arrives fails the
   * assertion as a value instead of passing as one absence matching another.
   */
  let seen = '';
  const server = createServer((req, res) => {
    seen = req.headers['user-agent'] ?? '';
    res.writeHead(200, {'Content-Type': 'image/png'});
    res.end(Buffer.from([0]));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const {port} = server.address() as {port: number};
    await addDownload(`http://127.0.0.1:${port}/1/2/3.png`);
    return seen;
  } finally {
    server.close();
  }
}

describe('User agent', () => {
  /*
   * The version half comes from package.json, so asserting the exact string
   * would only assert that two imports of the same file agree. The shape is
   * what matters: OSM wants something it can attribute, and release-please
   * moves the number without touching this test.
   */
  it('identifies the app and its version', () => {
    assert.match(userAgent, /^OMFGv2\/\d+\.\d+\.\d+/);
  });

  /*
   * Node's fetch sends no User-Agent unless one is passed, which is what the
   * OSM tile usage policy asks for — and what got Overpass, before it was
   * dropped, to answer 406.
   */
  it('is sent on tile downloads', async () => {
    assert.equal(await capturedUserAgent(), userAgent);
  });
});
