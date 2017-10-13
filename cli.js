const {argv} = require('./arguments');
const {downloadTiles} = require('./src/main');

(async function() {
  await downloadTiles(argv);
})();
