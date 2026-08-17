import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  CategorySlice,
  DistrictLoad,
  HourlyActivityPoint,
  KpiPoint,
  RegionStat,
  RequestStatsResponse,
  SummaryResponse,
} from './types';

/**
 * Boshqaruv paneli va analitika sahifalari uchun real API hook'lari.
 * Har biri `attendance` xususiyatidagi naqshga amal qiladi: bitta
 * react-query `useQuery`, backenddan mock bilan bir xil shaklda ma'lumot
 * qaytaradi, shu sababli sahifalar mock -> API o'tishida o'zgarmaydi.
 */

/** GET /analytics/summary — bosh sahifadagi barcha KPI kartalari uchun. */
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => api.get<SummaryResponse>('/analytics/summary'),
    staleTime: 30_000,
  });
}

/** GET /analytics/kpi-trend — oylik kelgan/hal qilingan murojaatlar trendi. */
export function useKpiTrend() {
  return useQuery({
    queryKey: ['analytics', 'kpi-trend'],
    queryFn: () => api.get<KpiPoint[]>('/analytics/kpi-trend'),
    staleTime: 60_000,
  });
}

/** GET /analytics/category-distribution — yo'nalishlar bo'yicha taqsimot. */
export function useCategoryDistribution() {
  return useQuery({
    queryKey: ['analytics', 'category-distribution'],
    queryFn: () => api.get<CategorySlice[]>('/analytics/category-distribution'),
    staleTime: 30_000,
  });
}

/** GET /analytics/region-stats — tumanlar kesimida murojaat/hal qilish soni. */
export function useRegionStats() {
  return useQuery({
    queryKey: ['analytics', 'region-stats'],
    queryFn: () => api.get<RegionStat[]>('/analytics/region-stats'),
    staleTime: 30_000,
  });
}

/** GET /analytics/hourly-activity — soat bo'yicha murojaatlar oqimi. */
export function useHourlyActivity() {
  return useQuery({
    queryKey: ['analytics', 'hourly-activity'],
    queryFn: () => api.get<HourlyActivityPoint[]>('/analytics/hourly-activity'),
    staleTime: 60_000,
  });
}

/** GET /analytics/district-loads — tuman yuklamasi (dashboard pastki blok). */
export function useDistrictLoads() {
  return useQuery({
    queryKey: ['analytics', 'district-loads'],
    queryFn: () => api.get<DistrictLoad[]>('/analytics/district-loads'),
    staleTime: 30_000,
  });
}

/** GET /requests/stats — hal qilish darajasi kabi jonli agregatlar uchun. */
export function useRequestStats() {
  return useQuery({
    queryKey: ['requests', 'stats'],
    queryFn: () => api.get<RequestStatsResponse>('/requests/stats'),
    staleTime: 30_000,
  });
}
