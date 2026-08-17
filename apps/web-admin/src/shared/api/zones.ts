import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { api } from './client';

export interface ZoneProps {
  code: string;
  kind: 'DISTRICT' | 'MAHALLA';
  soato: string | null;
  name_uz_lt: string;
  name_uz_cyr: string | null;
  name_ru: string | null;
  parent_code: string | null;
  centroid: [number, number]; // [lng, lat]
  area_m2: number | null;
}

export type ZoneFeature = Feature<Geometry, ZoneProps>;
export type ZoneCollection = FeatureCollection<Geometry, ZoneProps>;

export interface ZoneMeta {
  code: string;
  kind: 'DISTRICT' | 'MAHALLA';
  nameUzLat: string;
  nameUzCyr: string | null;
  nameRu: string | null;
  centroidLat: number;
  centroidLng: number;
}

/** District + mahalla boundaries as GeoJSON (served from the backend zones table). */
export function fetchZonesGeoJson(kind: 'district' | 'mahalla'): Promise<ZoneCollection> {
  return api.get<ZoneCollection>(`/zones/geojson?kind=${kind}`);
}

export function fetchZoneList(kind?: 'district' | 'mahalla'): Promise<ZoneMeta[]> {
  return api.get<ZoneMeta[]>(`/zones${kind ? `?kind=${kind}` : ''}`);
}
