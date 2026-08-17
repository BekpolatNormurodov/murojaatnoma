/* ============================================================
   Boshqaruv paneli + Analitika ("hisobot") — backend javob tiplari
   GET /api/analytics/* va GET /api/requests/stats
   Har bir interfeys backenddagi mock eksportlari bilan bir xil maydon
   nomlariga ega — sahifalar mock -> API o'tishida o'zgarmaydi.
   ============================================================ */

import type { RequestCategory, RequestStatus } from '@/shared/data/types';

/** GET /analytics/summary — mock `SUMMARY` obyektining aynan o'zi. */
export interface SummaryResponse {
  totalRequests: number;
  resolved: number;
  inProgress: number;
  activeWorkers: number;

  // Davomat
  checkedInToday: number;
  confirmedToday: number;
  insideRegion: number;
  avgAttendance: number;

  // Kameralar
  camerasOnline: number;
  camerasTotal: number;
  detections24h: number;

  // Moliya / kommunal
  utilityCharged: number;
  utilityCollected: number;
  utilityDebt: number;
  collectionRate: number;
  turnover: number;
}

/** GET /analytics/kpi-trend — mock `KPI_TREND` / `KpiPoint`. */
export interface KpiPoint {
  label: string;
  total: number;
  resolved: number;
}

/** GET /analytics/category-distribution — mock `CATEGORY_DISTRIBUTION` / `CategorySlice`. */
export interface CategorySlice {
  category: RequestCategory;
  value: number;
}

/** GET /analytics/region-stats — mock `REGION_STATS` / `RegionStat`. */
export interface RegionStat {
  region: string;
  requests: number;
  resolved: number;
}

/** GET /analytics/hourly-activity — mock `HOURLY_ACTIVITY` inline tipi. */
export interface HourlyActivityPoint {
  hour: string;
  value: number;
}

/** `DISTRICT_LOADS[].district` — mock `District` bilan bir xil (createdAt siz). */
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

/** GET /analytics/district-loads — mock `DISTRICT_LOADS` / `DistrictLoad`. */
export interface DistrictLoad {
  district: DistrictDto;
  requests: number;
  resolved: number;
  workers: number;
  cameras: number;
  load: 'normal' | 'busy' | 'critical';
}

/** GET /requests/stats — hal qilish darajasi va boshqa agregatlar uchun. */
export interface RequestStatsResponse {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byCategory: Record<RequestCategory, number>;
  byDistrict: { districtId: string; count: number }[];
}
