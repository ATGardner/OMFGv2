export default class DownloadError extends Error {
  name = 'DownloadError';

  /*
   * The HTTP status the tile server answered with. `addDownload` reads it to
   * decide whether the failure is worth retrying.
   */
  readonly code: number;

  constructor(code = 0, message?: string) {
    super(message);
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DownloadError);
    }

    this.code = code;
  }
}
