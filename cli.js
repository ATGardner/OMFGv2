const {argv} = require('./arguments');
const {awaitJob, downloadTiles} = require('./src/main');

(async function() {
  const id = await downloadTiles(argv);
  const result = await awaitJob(id);
  console.log(result);
})();
