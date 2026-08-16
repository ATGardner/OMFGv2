import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {PassThrough} from 'node:stream';
import {after, describe, it} from 'node:test';
import express from 'express';
import {transports} from 'winston';
import {
  errorLogger,
  getLogger,
  requestLogger,
  resolveLogLevel,
} from '../src/utils/logging.ts';

/*
 * A stream transport on the shared logger, so these assert what is actually
 * written rather than that a spy was called. It stays attached for the whole
 * file — every test in a `node --test` file shares one process, and each test
 * reads only the lines its own request produced.
 */
const captured = new PassThrough();
const lines: Record<string, string>[] = [];
const transport = new transports.Stream({stream: captured});

getLogger().add(transport);
captured.on('data', (chunk: Buffer) => {
  for (const line of chunk.toString().split('\n').filter(Boolean)) {
    lines.push(JSON.parse(line) as Record<string, string>);
  }
});

after(() => {
  getLogger().remove(transport);
});

/*
 * The transport writes on the next tick, so a test that read `lines` straight
 * after its request would race the logger.
 */
async function drain(): Promise<Record<string, string>[]> {
  await new Promise((resolve) => setImmediate(resolve));
  return lines.splice(0, lines.length);
}

async function serve(
  build: (app: express.Express) => void,
  path: string,
): Promise<void> {
  const app = express();
  app.use(requestLogger);
  build(app);
  app.use(errorLogger);
  /*
   * Stands in for index.ts's error handler. Without one, Express's default
   * prints the stack to stderr and buries the test output in it — and the
   * point here is that `errorLogger` passes the error on to whatever comes
   * next, so something has to be next.
   */
  app.use(((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).send('failed');
  }) as express.ErrorRequestHandler);
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const {port} = server.address() as {port: number};
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    await response.text();
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}

describe('resolveLogLevel', () => {
  it('defaults to verbose when LOG_LEVEL is unset or empty', () => {
    // An env var nothing sets, which is the shape of the real unset case.
    assert.equal(resolveLogLevel(process.env.OMFG_NO_SUCH_LEVEL), 'verbose');
    assert.equal(resolveLogLevel(''), 'verbose');
  });

  it('accepts every level winston knows, in any case', () => {
    assert.equal(resolveLogLevel('debug'), 'debug');
    assert.equal(resolveLogLevel('error'), 'error');
    assert.equal(resolveLogLevel('WARN'), 'warn');
  });

  /*
   * The failure this guards against is silent: winston takes an unknown level
   * without complaint and then logs nothing at all, so a typo in a deployment
   * would read as an app that had stopped doing anything.
   */
  it('falls back to the default for a level winston does not know', () => {
    assert.equal(resolveLogLevel('quiet'), 'verbose');
    assert.equal(resolveLogLevel('trace'), 'verbose');
    // Not a level just because Object.prototype has the property.
    assert.equal(resolveLogLevel('toString'), 'verbose');
  });
});

describe('logging', () => {
  it('logs one line per request, with method, path and status', async () => {
    await drain();
    await serve((app) => {
      app.get('/queue/:id', (req, res) => {
        res.send('ok');
      });
    }, '/queue/abc');
    const [line, ...rest] = await drain();
    assert.equal(rest.length, 0);
    assert.equal(line.label, 'request');
    assert.equal(line.level, 'info');
    assert.match(line.message, /^HTTP GET \/queue\/abc 200 \d+ms$/);
  });

  it('logs a request no route matched', async () => {
    await drain();
    // No routes at all, so Express answers the 404 itself.
    await serve((app) => app.disable('x-powered-by'), '/nope');
    const [line] = await drain();
    assert.match(line.message, /^HTTP GET \/nope 404 \d+ms$/);
  });

  /*
   * The stack is the reason this middleware exists — the error handler that
   * runs after it turns the failure into a 500 and the stack is gone. An
   * Error passed as the second argument only survives because the logger
   * combines `errors({stack: true})`.
   */
  it('logs a thrown error with its stack, then lets it through', async () => {
    await drain();
    await serve((app) => {
      app.get('/boom', () => {
        throw new Error('kaboom');
      });
    }, '/boom');
    const logged = await drain();
    const error = logged.find(({label}) => label === 'error');
    assert.ok(error, 'the error was not logged');
    assert.equal(error.level, 'error');
    assert.match(error.message, /Failed handling GET \/boom/);
    assert.match(error.stack, /Error: kaboom/);
    // Passed on rather than swallowed: Express still has to answer with a 500.
    const request = logged.find(({label}) => label === 'request');
    assert.match(request?.message ?? '', /500/);
  });
});
