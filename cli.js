const {argv} = require('./arguments');
const {downloadTiles2} = require('./src/main');

(async function() {
  await downloadTiles2(argv);
})();
