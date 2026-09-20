import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readdir, rm, utimes, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import type {PrunedJobs} from '../src/DownloadManager.ts';
import {type JobTable, prune} from '../src/retention.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/*
 * A stand-in for DownloadManager, so the ages under test are the pruner's
 * arithmetic rather than a job that would have to be run to produce them. It
 * records the cutoff it was handed, which is the only thing the pruner tells
 * the table about time.
 */
const nothingPruned: PrunedJobs = {jobs: 0, files: []};

interface FakeTable extends JobTable {
  cutoff: number;
}

function fakeTable(
  pruned: PrunedJobs = nothingPruned,
  referenced: string[] = [],
): FakeTable {
  const table: FakeTable = {
    cutoff: 0,
    pruneJobs(before: number): PrunedJobs {
      table.cutoff = before;
      return pruned;
    },
    referencedFiles: () => referenced,
  };
  return table;
}

let dir = '';

async function write(name: string, ageMs = 0): Promise<void> {
  const path = join(dir, name);
  await writeFile(path, 'zip');
  if (ageMs > 0) {
    const when = new Date(Date.now() - ageMs);
    await utimes(path, when, when);
  }
}

function remaining(): Promise<string[]> {
  return readdir(dir);
}

describe('Retention', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'omfg-retention-'));
  });

  afterEach(async () => {
    await rm(dir, {recursive: true, force: true});
  });

  describe('expired jobs', () => {
    it('deletes the files of the jobs the table dropped', async () => {
      await write('old - Orux.zip');
      await write('old - BCNav.zip');
      const jobs = fakeTable({
        jobs: 1,
        files: ['output/old - Orux.zip', 'output/old - BCNav.zip'],
      });

      await prune({dir, jobs});

      assert.deepEqual(await remaining(), []);
    });

    /*
     * The cutoff is the whole of what the table is told: a job with no
     * finishedAt fails that comparison on its side, which is why nothing here
     * has to know whether a job is running.
     */
    it('asks the table for jobs finished before the TTL', async () => {
      const jobs = fakeTable();

      await prune({dir, jobs, jobTtlMs: HOUR_MS});

      const age = Date.now() - jobs.cutoff;
      assert.ok(
        age >= HOUR_MS && age < HOUR_MS + 5_000,
        `cutoff was ${age}ms ago`,
      );
    });

    // A failed job names no file, and a result may have been removed by hand.
    it('survives a result whose file is already gone', async () => {
      const jobs = fakeTable({jobs: 1, files: ['output/missing.zip']});

      await prune({dir, jobs});

      assert.deepEqual(await remaining(), []);
    });
  });

  describe('orphaned files', () => {
    it('deletes a file older than the file TTL that no job claims', async () => {
      await write('abandoned - Orux.zip', 8 * DAY_MS);

      await prune({dir, jobs: fakeTable()});

      assert.deepEqual(await remaining(), []);
    });

    it('leaves a file younger than the file TTL alone', async () => {
      await write('fresh - Orux.zip', 2 * DAY_MS);

      await prune({dir, jobs: fakeTable()});

      assert.deepEqual(await remaining(), ['fresh - Orux.zip']);
    });

    /*
     * The rule that keeps the two ages from fighting. A job still in the table
     * hands out a download URL for its file, so age alone must not take it —
     * only the job going takes it, in the pass above.
     */
    it('leaves an old file a surviving job still points at', async () => {
      await write('claimed - Orux.zip', 30 * DAY_MS);
      const jobs = fakeTable(nothingPruned, ['output/claimed - Orux.zip']);

      await prune({dir, jobs});

      assert.deepEqual(await remaining(), ['claimed - Orux.zip']);
    });

    /*
     * Nothing puts one there today, but a sweep that unlinks blindly would
     * fail on the first one rather than skip it.
     */
    it('leaves directories where they are', async () => {
      await mkdir(join(dir, 'nested'));
      await write('old - Orux.zip', 8 * DAY_MS);

      await prune({dir, jobs: fakeTable()});

      assert.deepEqual(await remaining(), ['nested']);
    });
  });
});
