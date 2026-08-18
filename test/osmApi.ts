import assert from 'node:assert/strict';
import {type Server, createServer} from 'node:http';
import {after, before, describe, it} from 'node:test';
import {NotFoundError} from '../src/errors.ts';
import {fetchRelation} from '../src/osm/osmApi.ts';
import {userAgent} from '../src/userAgent.ts';

/*
 * A stand-in for api.openstreetmap.org rather than the API itself: the cases
 * worth pinning are its failures, and a test that had to ask the real service
 * for a 410 would be asking it to keep a deleted relation deleted forever.
 */
interface Reply {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

/*
 * Assigned in `before` and in each case; node:test runs both ahead of the
 * assertions that read them.
 */
let server: Server | null = null;
let baseUrl = '';
let reply: (url: string) => Reply = () => ({status: 200, body: '{}'});
let lastRequest: {url?: string; userAgent?: string} = {};

before(async () => {
  const listener = createServer((req, res) => {
    lastRequest = {url: req.url, userAgent: req.headers['user-agent']};
    const {status, body, headers = {}} = reply(req.url ?? '');
    res.writeHead(status, headers);
    res.end(body);
  });
  await new Promise<void>((resolve) => {
    listener.listen(0, resolve);
  });
  server = listener;
  const {port} = listener.address() as {port: number};
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
});

describe('OSM API', () => {
  it('asks for the relation and its members in one call', async () => {
    reply = () => ({
      status: 200,
      body: JSON.stringify({elements: [{type: 'relation', id: 7}]}),
      headers: {'Content-Type': 'application/json'},
    });
    const result = await fetchRelation(7, baseUrl);
    assert.equal(lastRequest.url, '/relation/7/full.json');
    assert.deepEqual(result, {elements: [{type: 'relation', id: 7}]});
  });

  it('identifies itself', async () => {
    reply = () => ({
      status: 200,
      body: '{}',
      headers: {'Content-Type': 'application/json'},
    });
    await fetchRelation(7, baseUrl);
    assert.equal(lastRequest.userAgent, userAgent);
  });

  /*
   * The two statuses that mean "you named something OSM cannot return". Both
   * answer with an empty body, so the message has to come from the id rather
   * than from the response — which is the whole reason they are handled ahead
   * of the generic path below.
   */
  it('turns a 404 into a not-found error naming the relation', async () => {
    reply = () => ({status: 404, body: ''});
    await assert.rejects(fetchRelation(7, baseUrl), {
      name: 'NotFoundError',
      message: 'Relation 7 was not found',
    });
  });

  it('turns a 410 into a deleted error naming the relation', async () => {
    // Present but blank, exactly as the API sends it for a deleted relation.
    reply = () => ({status: 410, body: '', headers: {Error: ''}});
    await assert.rejects(fetchRelation(7, baseUrl), {
      name: 'NotFoundError',
      message: 'Relation 7 has been deleted',
    });
  });

  it("carries the API's own message on any other failure", async () => {
    reply = () => ({
      status: 400,
      body: 'Relation with id 7\nis broken\n',
      headers: {'Content-Type': 'text/plain'},
    });
    await assert.rejects(fetchRelation(7, baseUrl), (error: Error) => {
      assert.ok(!(error instanceof NotFoundError));
      assert.match(error.message, /400/);
      // Whitespace collapsed, so a multi-line body stays one log line.
      assert.match(error.message, /Relation with id 7 is broken/);
      return true;
    });
  });

  /*
   * The `Error` header wins over the body, and an HTML error page from a proxy
   * that never reached the API is dropped rather than logged in full.
   */
  it('prefers the Error header and ignores an HTML body', async () => {
    reply = () => ({
      status: 500,
      body: '<!DOCTYPE html><html><body>a proxy error page</body></html>',
      headers: {'Content-Type': 'text/html', Error: 'something went wrong'},
    });
    await assert.rejects(fetchRelation(7, baseUrl), {
      message:
        'Request failed with status 500 Internal Server Error - something went wrong',
    });

    reply = () => ({
      status: 500,
      body: '<!DOCTYPE html><html><body>a proxy error page</body></html>',
      headers: {'Content-Type': 'text/html'},
    });
    await assert.rejects(fetchRelation(7, baseUrl), {
      message: 'Request failed with status 500 Internal Server Error',
    });
  });
});
