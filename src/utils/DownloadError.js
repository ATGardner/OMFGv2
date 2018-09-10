class DownloadError extends Error {
  constructor(code = 0, ...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DownloadError);
    }

    // Custom debugging information
    this.code = code;
  }
}

module.exports = DownloadError;
