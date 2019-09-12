import {getParser} from './arguments.js';
import downloadManager from './src/DownloadManager.js';
(async function() {
  const {argv} = getParser(process.argv.slice(2)).config();
  const id = await downloadManager.startDownload(argv);
  const result = await downloadManager.awaitDownload(id);
  console.log(result);
})();
