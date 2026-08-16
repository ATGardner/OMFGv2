import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {describe, it} from 'node:test';
import express from 'express';
import type {Histogram} from 'prom-client';
import {
  metricsMiddleware,
  observeTileDownload,
  registry,
  trackTileQueue,
} from '../src/metrics.ts';

/*
 * The registry is module-level and shared by every test in this file, so
 * nothing here asserts an absolute count — each test reads the series it cares
 * about before and after and compares the delta.
 */
async function histogramCount(
  name: string,
  labels: Record<string, string>,
): Promise<number> {
  /*
   * The registry types every metric it hands back as the base `Metric`, whose
   * values carry no `metricName` — only a histogram's do, and `_count` is the
   * series these tests are after.
   */
  const metric = registry.getSingleMetric(name) as
    Histogram<string> | undefined;
  assert.ok(metric, `${name} is not registered`);
  const {values} = await metric.get();
  const match = values.find(
    (value) =>
      value.metricName === `${name}_count` &&
      Object.entries(labels).every(
        ([key, expected]) => String(value.labels[key]) === expected,
      ),
  );
  return match?.value ?? 0;
}

/*
 * A real listening server rather than a hand-rolled req/res pair, because the
 * label under test — `req.route.path` — is something only Express's own router
 * fills in, and a fake would assert the fake.
 */
async function request(path: string): Promise<void> {
  const app = express();
  app.use(metricsMiddleware);
  app.get('/queue/:id', (req, res) => {
    res.send('ok');
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const {port} = server.address() as {port: number};
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    await response.text();
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

const HTTP = 'omfg_http_request_duration_seconds';
const TILE = 'omfg_tile_download_duration_seconds';

describe('metrics', () => {
  /*
   * `/queue/:id` carries a job id, so labelling by the requested path would
   * mint a series per download and blow up the registry's cardinality over a
   * long-lived process.
   */
  it('labels requests by route pattern, not by path', async () => {
    const labels = {route: '/queue/:id', status: '200'};
    const before = await histogramCount(HTTP, labels);
    await request('/queue/abc');
    await request('/queue/def');
    assert.equal(await histogramCount(HTTP, labels), before + 2);
  });

  /*
   * A path with no route has no pattern to label with, and a crawler must not
   * be able to mint a series per URL it tries.
   */
  it('collapses unmatched paths into one series', async () => {
    const labels = {route: 'unmatched', status: '404'};
    const before = await histogramCount(HTTP, labels);
    await request('/nope');
    await request('/also-nope');
    assert.equal(await histogramCount(HTTP, labels), before + 2);
  });

  /*
   * A 304 resolves with no data. Counting it as a plain success would hide the
   * revalidation traffic that re-running the same route is almost entirely
   * made of.
   */
  it('separates a 304 revalidation from a downloaded tile', async () => {
    const before = {
      success: await histogramCount(TILE, {outcome: 'success'}),
      notModified: await histogramCount(TILE, {outcome: 'not_modified'}),
    };
    await observeTileDownload(() =>
      Promise.resolve({data: Buffer.from('tile')}),
    );
    await observeTileDownload(() => Promise.resolve({}));
    assert.equal(
      await histogramCount(TILE, {outcome: 'success'}),
      before.success + 1,
    );
    assert.equal(
      await histogramCount(TILE, {outcome: 'not_modified'}),
      before.notModified + 1,
    );
  });

  it('records a failed download and rethrows it', async () => {
    const before = await histogramCount(TILE, {outcome: 'error'});
    await assert.rejects(
      observeTileDownload(() => Promise.reject(new Error('boom'))),
      /boom/,
    );
    assert.equal(await histogramCount(TILE, {outcome: 'error'}), before + 1);
  });

  /*
   * The gauge samples the queue at scrape time, so a depth that changed after
   * registration still has to be the one reported.
   */
  it('samples the tile queue at scrape time', async () => {
    const queue = {size: 0, pending: 0};
    trackTileQueue(queue);
    queue.size = 7;
    queue.pending = 3;
    const scrape = await registry.metrics();
    assert.match(scrape, /omfg_tile_queue_depth\{state="waiting"} 7/);
    assert.match(scrape, /omfg_tile_queue_depth\{state="running"} 3/);
  });
});
