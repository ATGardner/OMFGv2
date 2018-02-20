const getParser = require('./arguments');
const downloadManager = require('./src/DownloadManager');

(async function() {
  const {argv} = getParser(process.argv.slice(2)).config();
  const id = await downloadManager.startDownload(argv);
  const result = await downloadManager.awaitDownload(id);
  console.log(result);
})();
