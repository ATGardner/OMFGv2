import type {RouteSource} from '../types.ts';
import LocalFilesSource from './localFilesSource.ts';
import OsmRelationSource from './osmRelationSource.ts';

export interface LocalFilesData {
  inputFiles: string[];
  routeAttribution?: string;
}

export function getRouteSource(
  sourceType: 'localFile',
  data: LocalFilesData,
): RouteSource;
export function getRouteSource(
  sourceType: 'osmRelation',
  data: number,
): RouteSource;
export function getRouteSource(
  sourceType: string,
  data: LocalFilesData | number,
): RouteSource | undefined;
export function getRouteSource(
  sourceType: string,
  data: LocalFilesData | number,
): RouteSource | undefined {
  switch (sourceType) {
    case 'localFile':
      return new LocalFilesSource(data as LocalFilesData);
    case 'osmRelation':
      return new OsmRelationSource(data as number);
    default:
      return undefined;
  }
}
