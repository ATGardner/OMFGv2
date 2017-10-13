const {readFileSync} = require('fs');
const {extname} = require('path');
const AdmZip = require('adm-zip');
const {gpx, kml} = require('@mapbox/togeojson');
const {DOMParser} = require('xmldom');

function readDocFromFile(fileName) {
  const text = readFileSync(fileName, 'utf8');
  return new DOMParser().parseFromString(text);
}

function readFile(fileName) {
  const ext = extname(fileName);
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
      const zip = new AdmZip(fileName);
      const zipEntries = zip.getEntries();
      const docEntry = zipEntries.find(({name}) => extname(name) === '.kml');
      if (!docEntry) {
        throw new Error('KMZ file is invalid');
      }

      const kmlString = zip.readAsText(docEntry);
      const doc = new DOMParser().parseFromString(kmlString);
      return kml(doc);
    }
    default:
      throw new Error('Unrecognized file type. Use only gpx/kml files.');
  }
}

class LocalFilesSource {
  constructor(inputFiles) {
    this.inputFiles = inputFiles;
  }

  getGeoJson() {
    const jsons = this.inputFiles.map(readFile);
    const arrayOfFeatureArrays = jsons.map(j => j.features);
    return {
      features: [].concat.apply(...arrayOfFeatureArrays),
      type: 'FeatureCollection',
    };
  }

  toString() {
    return this.inputFiles;
  }
}

module.exports = LocalFilesSource;
