const {loggers, format, transports} = require('winston');
// const expressWinston = require('express-winston');
// const {LoggingWinston} = require('@google-cloud/logging-winston');

// const {
//   env: {NODE_ENV},
// } = process;
const {combine, timestamp, label, simple} = format;
// const colorize = NODE_ENV !== 'production';
// const requestLogger = expressWinston.logger({
//   transports: [
//     new LoggingWinston(),
//     new transports.Console({
//       json: false,
//       colorize,
//     }),
//   ],
//   expressFormat: true,
//   meta: false,
// });
// const errorLogger = expressWinston.errorLogger({
//   transports: [
//     new LoggingWinston(),
//     new transports.Console({
//       json: true,
//       colorize,
//     }),
//   ],
// });

function getLogger(name = 'omfg') {
  return loggers.get(name, {
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new transports.Console()],
  });
}

module.exports = {
  // requestLogger,
  // errorLogger,
  getLogger,
};
