import type {ErrorRequestHandler, RequestHandler} from 'express';
import {type Logger, createLogger, format, transports} from 'winston';

const {colorize, combine, errors, json, simple, timestamp} = format;

/*
 * `maxsize` on its own only rolls over to a new file, so the disk still fills
 * up in 20MB pieces. `maxFiles` is what unlinks the oldest, and `tailable`
 * keeps the newest entries in the unsuffixed name instead of moving the live
 * log to a new number on every rotation. Each transport is capped at
 * maxsize * maxFiles, so this pair costs 200MB at worst.
 */
const fileOptions = {
  maxsize: 20 * 1024 * 1024,
  maxFiles: 5,
  tailable: true,
};

/*
 * One logger with a child per module, rather than the `loggers` container this
 * replaces. The container builds a separate logger per label, each with its
 * own transports — which was free when the only transport was the console, but
 * would now open the two files below once per module, several writers
 * appending to one path with independent ideas of when it has hit `maxsize`.
 *
 * `verbose` because that is the level a download job reports its progress at,
 * and that progress is the only account of a job that outlives the request.
 */
const logger = createLogger({
  level: 'verbose',
  /*
   * `errors({stack: true})` is what makes `logger.error('...', error)` carry
   * the stack instead of an empty object: winston otherwise serialises an
   * Error by its own enumerable properties, of which it has none.
   */
  format: combine(timestamp(), errors({stack: true}), json()),
  transports: [
    // Write all errors to a dedicated file
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      ...fileOptions,
    }),
    // Write all logs (verbose, info, warn, error) to a combined file
    new transports.File({filename: 'logs/combined.log', ...fileOptions}),
  ],
});

/*
 * Kubernetes collects a container's logs by capturing what it writes to
 * stdout, so this transport is what makes the app visible to `kubectl logs`
 * and to any log collector at all — the files above are only reachable by
 * exec'ing into the pod, and they go with it when it is replaced.
 *
 * Production inherits the logger's own JSON format — one object per line,
 * stack traces included, which is what a collector parses. Errors stay on
 * stdout with everything else rather than splitting to stderr; the two streams
 * can interleave out of order once a collector merges them back, and `level`
 * is already a field to query on.
 */
const consoleOptions =
  process.env.NODE_ENV === 'production'
    ? {}
    : {format: combine(colorize(), simple())};

logger.add(new transports.Console(consoleOptions));

export function getLogger(name = 'omfg'): Logger {
  return logger.child({label: name});
}

const requestLog = getLogger('request');
const errorLog = getLogger('error');

/*
 * These two were express-winston's `logger`/`errorLogger` middleware. Nothing
 * about them needed a package: the configuration in use asked for one fixed
 * line per request and no metadata, so the dependency — last released in 2021,
 * and pulling in chalk 2 and lodash — bought a template string.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = performance.now();
  /*
   * `close` rather than `finish`, so a client that hangs up mid-request is
   * still accounted for: `finish` never fires on a dropped connection, and a
   * request that vanished from the log entirely is the one you go looking for.
   * The same reason `metricsMiddleware` picks it.
   */
  res.on('close', () => {
    const duration = Math.round(performance.now() - start);
    const status = res.writableEnded ? res.statusCode : 'aborted';
    requestLog.info(
      `HTTP ${req.method} ${req.originalUrl} ${status} ${duration}ms`,
    );
  });
  next();
};

/*
 * Logs and re-throws. The response is the error handler's business — this only
 * has to make sure the failure is recorded before that handler turns it into a
 * 500 and the stack is gone.
 */
export const errorLogger: ErrorRequestHandler = (error, req, res, next) => {
  errorLog.error(`Failed handling ${req.method} ${req.originalUrl}`, error);
  next(error);
};
