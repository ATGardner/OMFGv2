import {getParser, toDownloadRequest} from './arguments.ts';
import downloadManager from './src/DownloadManager.ts';

const argv = await getParser(process.argv.slice(2)).config().argv;
const id = downloadManager.startDownload(toDownloadRequest(argv));
const result = await downloadManager.awaitDownload(id);
console.log(result);
