import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Priority, RequestCategory, RequestStatus } from '@/shared/data/types';

/* GET /analytics/overview — backend `overview.types.ts` bilan aynan bir xil. */

export interface TrendPoint {
  key: string;
  label: string;
  created: number;
  resolved: number;
}

export interface OverviewMurojaat {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  open: number;
  overdue: number;
  dueSoon: number;
  unassigned: number;
  resolutionRate: number | null;
  slaRate: number | null;
  avgResolutionHours: number | null;
  avgRating: number | null;
  ratedCount: number;
  created30: number;
  createdPrev30: number;
  resolved30: number;
  resolvedPrev30: number;
  openByPriority: Record<Priority, number>;
  bySource: { citizen: number; legacy: number };
}

export interface OverviewWorkforce {
  total: number;
  checkedIn: number;
  lateToday: number;
  notCheckedIn: number;
  reportingNow: number;
  insideZone: number;
  outsideZone: number;
  stale: number;
  neverReported: number;
  staleMinutes: number;
  onTimeRate: number | null;
}

export interface EmployeeLoad {
  id: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  open: number;
  overdue: number;
  resolved: number;
  avgRating: number | null;
}

export interface MahallaLoad {
  code: string;
  name: string;
  total: number;
  open: number;
  overdue: number;
}

export interface MurojaatPin {
  id: string;
  title: string;
  status: RequestStatus;
  priority: Priority;
  category: RequestCategory;
  lat: number;
  lng: number;
  overdue: boolean;
  createdAt: string;
  mahallaCode: string | null;
}

export interface RecentMurojaat {
  id: string;
  title: string;
  category: RequestCategory;
  status: RequestStatus;
  priority: Priority;
  citizenName: string;
  address: string;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
  source: 'citizen' | 'legacy';
  kind: 'ariza' | 'shikoyat' | null;
  assignee: { id: string; fullName: string; avatarUrl: string | null } | null;
}

export interface Overview {
  generatedAt: string;
  murojaat: OverviewMurojaat;
  trend: { daily: TrendPoint[]; monthly: TrendPoint[] };
  categories: { category: RequestCategory; total: number; open: number }[];
  workforce: OverviewWorkforce;
  topEmployees: EmployeeLoad[];
  mahallas: MahallaLoad[];
  pins: MurojaatPin[];
  recent: RecentMurojaat[];
}

/** Boshqaruv paneli — bitta so'rov, har daqiqada yangilanadi. */
export function useOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<Overview>('/analytics/overview'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Davr bo'yicha o'zgarish, % — taqqoslash uchun asos bo'lmasa undefined. */
export function periodDelta(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** 125.5 soat -> "5.2 kun"; 14 -> "14 soat"; 0.5 -> "30 daq". */
export function formatDuration(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} daq`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} soat`;
  return `${Math.round((hours / 24) * 10) / 10} kun`;
}
