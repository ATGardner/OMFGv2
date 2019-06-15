const {readFileSync} = require('fs');
const {extname} = require('path');
const JSZip = require('jszip');
const {gpx, kml} = require('@mapbox/togeojson');
const {DOMParser} = require('xmldom');

function readDocFromFile(fileName) {
  const text = readFileSync(fileName, 'utf8');
  return new DOMParser().parseFromString(text);
}

async function readKmlStringFromKmz(fileName) {
  const data = readFileSync(fileName);
  const zip = new JSZip();
  await zip.loadAsync(data);
  const [docEntry] = zip.file(/\.kml$/);
  return docEntry.async('text');
}

async function readFile(fileName) {
  const ext = extname(fileName).toLocaleLowerCase();
  switch (ext) {
    case '.gpx': {
      const doc = readDocFromFile(fileName);
      return gpx(doc);
    }

    case '.kml': {
      const doc = readDocFromFile(fileName);
      return kml(doc);
    }

    case '.kmz': {
      const kmlString = await readKmlStringFromKmz(fileName);
      const doc = new DOMParser().parseFromString(kmlString);
      return kml(doc);
    }

    default:
      throw new Error('Unrecognized file type. Use only gpx/kml files.');
  }
}

class LocalFilesSource {
  constructor({inputFiles, routeAttribution}) {
    this.inputFiles = inputFiles;
    this.routeAttribution = routeAttribution;
  }

  get id() {
    return this.inputFiles.join();
  }

  async getGeoJson() {
    const promises = this.inputFiles.map(readFile);
    const jsons = await Promise.all(promises);
    const arrayOfFeatureArrays = jsons.map(j => j.features);
    return {
      features: Array.prototype.concat(...arrayOfFeatureArrays),
      type: 'FeatureCollection',
    };
  }

  toString() {
    return this.inputFiles;
  }
}

module.exports = LocalFilesSource;
