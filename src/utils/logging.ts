import type {ErrorRequestHandler, RequestHandler} from 'express';
import expressWinston from 'express-winston';
import winston from 'winston';

const {format, loggers, transports} = winston;
const {combine, timestamp, label, simple} = format;

export function getLogger(name = 'omfg'): winston.Logger {
  return loggers.get(name, {
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new transports.Console()],
  });
}

/*
 * These two have always been imported by name from index.ts, and were never
 * defined here — the server threw on that import before it could ever listen.
 * express-winston is already a dependency and is what the names describe, so
 * they are its `logger`/`errorLogger` middleware, built on the same winston
 * instances the rest of the app logs through.
 */
export const requestLogger: RequestHandler = expressWinston.logger({
  winstonInstance: getLogger('request'),
  meta: false,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
  colorize: false,
});

export const errorLogger: ErrorRequestHandler = expressWinston.errorLogger({
  winstonInstance: getLogger('error'),
});
