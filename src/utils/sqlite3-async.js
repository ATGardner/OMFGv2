const {promisify} = require('util');
const sqlite3 = require('sqlite3');

function promisifyFunctions(source, target, ...fnNames) {
  for (const fnName of fnNames) {
    target[fnName] = promisify(source[fnName]).bind(source);
  }
}

class Statement {
  constructor(statement) {
    this.statement = statement;
    promisifyFunctions(
      this.statement,
      this,
      'bind',
      'reset',
      'finalize',
      'run',
      'get',
      'all',
    );
  }

  each(callback, ...params) {
    return new Promise((resolve, reject) => {
      this.statement.each(...params, callback, (error, num) => {
        if (error) {
          reject(error);
        } else {
          resolve(num);
        }
      });
    });
  }
}
class Database {
  constructor(
    fileName = ':memory:',
    mode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  ) {
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(fileName, mode, error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    this.configure = this.db.configure.bind(this.db);
    promisifyFunctions(this.db, this, 'close', 'run', 'get', 'all', 'exec');
  }

  get open() {
    return this.db.open;
  }

  init() {
    return this.initPromise;
  }

  each(sql, callback, ...params) {
    return new Promise((resolve, reject) => {
      this.db.each(sql, ...params, callback, (error, num) => {
        if (error) {
          reject(error);
        } else {
          resolve(num);
        }
      });
    });
  }

  prepare(sql, ...params) {
    return new Promise((resolve, reject) => {
      const statement = this.db.prepare(sql, ...params, error => {
        if (error) {
          reject(error);
        } else {
          resolve(new Statement(statement));
        }
      });
    });
  }
}

module.exports = Database;
