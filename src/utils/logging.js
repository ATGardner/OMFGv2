import winston from 'winston';
const {format, loggers, transports} = winston;
const {combine, timestamp, label, simple} = format;
export function getLogger(name = 'omfg') {
  return loggers.get(name, {
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new transports.Console()],
  });
}
