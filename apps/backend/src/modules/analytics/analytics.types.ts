import { RequestCategory } from '@prisma/client';

/**
 * Response shapes for the `/analytics/*` endpoints. Every interface here is a
 * drop-in match (same field names, same nesting) for the corresponding
 * web-admin mock export in
 * `apps/web-admin/src/shared/data/mock.ts` / `./types.ts`.
 */

/** `GET /analytics/summary` — mirrors the mock `SUMMARY` object. */
export interface SummaryResponse {
  totalRequests: number;
  resolved: number;
  inProgress: number;
  activeWorkers: number;

  // Davomat (attendance)
  checkedInToday: number;
  confirmedToday: number;
  insideRegion: number;
  avgAttendance: number;

  // Kameralar (cameras)
  camerasOnline: number;
  camerasTotal: number;
  detections24h: number;

  // Moliya / kommunal (finance / utilities)
  utilityCharged: number;
  utilityCollected: number;
  utilityDebt: number;
  collectionRate: number;
  turnover: number;
}

/** `GET /analytics/kpi-trend` — mirrors the mock `KpiPoint` / `KPI_TREND`. */
export interface KpiPoint {
  label: string;
  total: number;
  resolved: number;
}

/** `GET /analytics/category-distribution` — mirrors the mock `CategorySlice`. */
export interface CategorySlice {
  category: RequestCategory;
  value: number;
}

/** `GET /analytics/region-stats` — mirrors the mock `RegionStat`. */
export interface RegionStat {
  region: string;
  requests: number;
  resolved: number;
}

/** `GET /analytics/hourly-activity` — mirrors the mock's inline `{hour, value}[]`. */
export interface HourlyActivityPoint {
  hour: string;
  value: number;
}

/**
 * Mirrors `District` from web-admin/src/shared/data/types.ts. The DB row
 * carries an extra `createdAt` column that the mock shape doesn't have, so
 * it is projected away when mapping.
 */
export interface DistrictDto {
  id: string;
  name: string;
  center: [number, number];
  polygon: [number, number][];
  color: string;
  population: number;
  households: number;
  areaKm2: number;
}

/** `GET /analytics/district-loads` — mirrors the mock `DistrictLoad`. */
export interface DistrictLoad {
  district: DistrictDto;
  requests: number;
  resolved: number;
  workers: number;
  cameras: number;
  load: 'normal' | 'busy' | 'critical';
}
