const {extractCoordinates} = require('./src/utils');

function a() {
  const json = extractCoordinates('test/inputs/simple.gpx');
  console.log(JSON.stringify(json));
}

a();