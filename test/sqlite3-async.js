const {existsSync, readdirSync, rmdirSync, unlinkSync} = require('fs');
const chai = require('chai');
const chaiString = require('chai-string');
const Database = require('../src/utils/sqlite3-async');

chai.use(chaiString);
const {expect} = chai;

let db;

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

describe('sqlite-async', () => {
  afterEach(async () => {
    if (db && db.open) {
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

  it('opens in memory database without parameters', () => {
    db = new Database();
    return db.init();
  });

  it('closes in memory database', async () => {
    db = new Database();
    await db.init();
    return db.close();
  });

  it('fails creating a database with an illegal fileName', async () => {
    db = new Database('?');
    try {
      await db.init();
      throw new Error('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.startWith('SQLITE_CANTOPEN');
    }
  });

  it('runs a simple create table', async () => {
    db = new Database();
    await db.init();
    return db.run('CREATE TABLE lorem (info TEXT)');
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
    expect(db.db.open).to.be.true;
    return db.init();
  });
});
