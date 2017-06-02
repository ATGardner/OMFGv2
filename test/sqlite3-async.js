const chai = require('chai');
const chaiString = require('chai-string');
const Database = require('../src/sqlite3-async');

chai.use(chaiString);
const {expect} = chai;

describe('sqlite-async', () => {
  it('opens in memory database without parameters', () => {
    const db = new Database();
    return db.init();
  });

  it('closes in memory database', async () => {
    const db = new Database();
    await db.init();
    return db.close();
  });

  it('fails creating a database with an illegal filename', async () => {
    const db = new Database('?');
    try {
      await db.init();
      throw new Error('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.startWith('SQLITE_CANTOPEN');
    }
  });

  it('runs a simple create table', async () => {
    const db = new Database();
    await db.init();
    return db.run('CREATE TABLE lorem (info TEXT)');
  });

  it('runs a simple get sql', async () => {
    const db = new Database();
    await db.init();
    await db.run('CREATE TABLE lorem (info TEXT)');
    const row = await db.run('SELECT * FROM lorem');
    expect(row).to.be.undefined;
  })
});