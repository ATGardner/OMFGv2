import {readFileSync} from 'fs';
import {extname} from 'path';
import {gpx, kml} from '@tmcw/togeojson';
import {DOMParser} from '@xmldom/xmldom';
import type {FeatureCollection, Geometry} from 'geojson';
import JSZip from 'jszip';
import type {RouteSource} from '../types.ts';

type NullableFeatureCollection = FeatureCollection<Geometry | null>;

/*
 * The content type is explicit because xmldom 0.9 wants it — the one-argument call this
 * replaces logs a deprecation warning and guesses.
 */
function parseXml(text: string) {
  return new DOMParser().parseFromString(text, 'text/xml');
}

function readDocFromFile(fileName: string) {
  const text = readFileSync(fileName, 'utf8');
  return parseXml(text);
}

async function readKmlStringFromKmz(fileName: string): Promise<string> {
  const data = readFileSync(fileName);
  const zip = new JSZip();
  await zip.loadAsync(data);
  const [docEntry] = zip.file(/\.kml$/);
  if (!docEntry) {
    throw new Error(`No .kml entry inside "${fileName}"`);
  }

  return docEntry.async('text');
}

async function readFile(fileName: string): Promise<NullableFeatureCollection> {
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
      return kml(parseXml(kmlString));
    }

    default:
      throw new Error('Unrecognized file type. Use only gpx/kml files.');
  }
}

export default class LocalFilesSource implements RouteSource {
  private readonly inputFiles: string[];

  readonly routeAttribution?: string;

  constructor({
    inputFiles,
    routeAttribution,
  }: {
    inputFiles: string[];
    routeAttribution?: string;
  }) {
    this.inputFiles = inputFiles;
    this.routeAttribution = routeAttribution;
  }

  get id(): string {
    return this.inputFiles.join();
  }

  async getGeoJson(): Promise<NullableFeatureCollection> {
    const promises = this.inputFiles.map(readFile);
    const jsons = await Promise.all(promises);
    return {
      features: jsons.flatMap((j) => j.features),
      type: 'FeatureCollection',
    };
  }

  toString(): string {
    return this.inputFiles.join();
  }
}
