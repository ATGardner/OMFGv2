import type {DatabaseSync} from 'node:sqlite';

/*
 * Tiles per transaction. Each commit is one fsync, so this trades a bounded
 * amount of re-download after a crash for roughly a 40x cut in write cost:
 * measured on a real tile workload, an insert in autocommit costs ~300us
 * against ~8us inside a transaction, and committing every 500 keeps the pause
 * that buys it near 2ms.
 */
const DEFAULT_BATCH_SIZE = 500;

/*
 * Groups writes on one connection into transactions. node:sqlite is
 * synchronous, so every insert would otherwise be its own implicit
 * transaction — an fsync per tile, on the thread serving the downloads.
 *
 * One of these per connection, not per job: a `Both` download writes through
 * three independent databases (the tile cache and the two packagers), and each
 * has to open and commit its own transaction.
 */
export default class WriteBatch {
  private readonly db: DatabaseSync;

  private readonly size: number;

  private pending = 0;

  constructor(db: DatabaseSync, size = DEFAULT_BATCH_SIZE) {
    this.db = db;
    this.size = size;
  }

  /*
   * Runs one write, opening a transaction if none is in flight and committing
   * once `size` of them have accumulated.
   *
   * `db.isTransaction` is the source of truth rather than a flag of our own:
   * SQLite rolls some failures back on its own, and a flag that disagreed with
   * it would send the next COMMIT or BEGIN into an error.
   */
  write(statement: () => void): void {
    if (!this.db.isTransaction) {
      this.db.exec('BEGIN');
      this.pending = 0;
    }

    try {
      statement();
    } catch (error) {
      /*
       * Discards the rest of this batch, which the caller re-downloads. The
       * alternative — leaving the transaction open after a failed statement —
       * risks committing around a write nobody checked.
       */
      if (this.db.isTransaction) {
        this.db.exec('ROLLBACK');
      }

      this.pending = 0;
      throw error;
    }

    this.pending += 1;
    if (this.pending >= this.size) {
      this.flush();
    }
  }

  /*
   * Commits whatever has accumulated. Every owner of a batch has to call this
   * before closing its database, or the last partial batch is lost.
   */
  flush(): void {
    if (this.db.isTransaction) {
      this.db.exec('COMMIT');
    }

    this.pending = 0;
  }
}
