import {existsSync, readdirSync, rmdirSync, unlinkSync} from 'fs';
import {setTimeout as delay} from 'timers/promises';
import {expect, use} from 'chai';
import chaiString from 'chai-string';
import Database from '../src/utils/sqlite3-async.ts';

use(chaiString);

let db: Database | undefined;

describe('sqlite-async', () => {
  afterEach(async () => {
    if (db?.open) {
      await db.close();
    }

    if (existsSync('test-subfolder')) {
      const fileNames = readdirSync('test-subfolder');
      for (const fileName of fileNames) {
        unlinkSync(`test-subfolder/${fileName}`);
      }

      rmdirSync('test-subfolder');
    }
  });
  it('opens in memory database without parameters', async () => {
    db = new Database();
    await db.init();
  });
  it('closes in memory database', async () => {
    db = new Database();
    await db.init();
    await db.close();
  });
  /*
   * The unopenable path is a file inside a directory that does not exist. It
   * used to be `?`, which only fails on Windows — every POSIX filesystem
   * accepts that as a filename, so the case passed by creating a file called
   * `?` in the repo root and leaving it there.
   */
  it('fails creating a database with an illegal fileName', async () => {
    db = new Database('no-such-folder/db.sqlite');
    try {
      await db.init();
      throw new Error('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.startWith('SQLITE_CANTOPEN');
    }
  });
  it('runs a simple create table', async () => {
    db = new Database();
    await db.init();
    await db.run('CREATE TABLE lorem (info TEXT)');
  });
  it('runs a simple get sql', async () => {
    db = new Database();
    await db.init();
    await db.run('CREATE TABLE lorem (info TEXT)');
    const row = await db.run('SELECT * FROM lorem');
    expect(row).to.be.undefined;
  });
  it('closes db after insert', async () => {
    db = new Database();
    await db.init();
    await db.run('CREATE TABLE lorem (info TEXT)');
    await db.run('INSERT INTO lorem (info) VALUES ($info)', {$info: 'blah'});
    await db.close();
  });
  it('returns from init even after a delay', async () => {
    db = new Database();
    await delay(50);
    expect(db.open).to.be.true;
    await db.init();
  });
});
