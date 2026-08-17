/**
 * Shared geospatial helpers used by the zones + locations modules:
 * Haversine distance and GeoJSON point-in-polygon (ray casting), plus a
 * bounding-box fast-reject. GeoJSON coordinates are always [lng, lat].
 */

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in meters (Haversine). */
export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

export type Position = [number, number]; // [lng, lat]
export type LinearRing = Position[];

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: LinearRing[]; // [outerRing, ...holes]
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: LinearRing[][];
}

export type GeoJsonAreaGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

/** Ray-casting test: is (lng, lat) inside a single linear ring? */
function pointInRing(lng: number, lat: number, ring: LinearRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
function pointInPolygonRings(lng: number, lat: number, rings: LinearRing[]): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0])) {
    return false;
  }
  for (let k = 1; k < rings.length; k += 1) {
    if (pointInRing(lng, lat, rings[k])) {
      return false; // inside a hole
    }
  }
  return true;
}

/** Point-in-polygon for a GeoJSON Polygon or MultiPolygon geometry. */
export function pointInGeometry(
  lng: number,
  lat: number,
  geometry: GeoJsonAreaGeometry,
): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygonRings(lng, lat, geometry.coordinates);
  }
  return geometry.coordinates.some((polygon) => pointInPolygonRings(lng, lat, polygon));
}

/** Quick bounding-box rejection before the full ray-casting test. */
export function withinBBox(
  lat: number,
  lng: number,
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
): boolean {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
