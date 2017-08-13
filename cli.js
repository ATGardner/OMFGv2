const { argv: {inputFiles, sourceType, sourceName, outputType, outputFile, minZoom, maxZoom }} = require('./arguments');
const { downloadTiles2 } = require('./src/main');

(async function() {
    await downloadTiles2({inputFiles, sourceType, sourceName, minZoom, maxZoom, outputType, outputFile});
})();
