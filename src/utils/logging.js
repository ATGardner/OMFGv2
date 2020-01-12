import winston from 'winston';
import expressWinston from 'express-winston';
const {format, loggers, transports} = winston;
const {combine, timestamp, label, simple} = format;
export function getLogger(name = 'omfg') {
  return loggers.get(name, {
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new transports.Console()],
  });
}

export const requestLogger = expressWinston.logger({
  transports: [new transports.Console()],
  format: simple(),
  meta: false,
  expressFormat: true,
  colorize: false,
});
export const errorLogger = expressWinston.errorLogger({
  transports: [new transports.Console()],
  format: simple(),
});
