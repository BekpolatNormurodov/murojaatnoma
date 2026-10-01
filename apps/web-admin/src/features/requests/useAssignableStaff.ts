import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Worker } from '@/shared/data/types';
import { useOversight } from '@/features/oversight/useOversight';

/** GET /applications/stats — murojaat pipeline numbers (also per employee). */
export interface ApplicationStats {
  total: number;
  byStatus: Record<'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED', number>;
  overdue: number;
  unassigned: number;
  avgResolutionHours: number | null;
  avgRating: number | null;
  ratedCount: number;
  byEmployee: Array<{
    employeeId: string;
    fullName: string;
    open: number;
    resolved: number;
    avgRating: number | null;
  }>;
}

export function useApplicationStats() {
  return useQuery({
    queryKey: ['applications', 'stats'],
    queryFn: () => api.get<ApplicationStats>('/applications/stats'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

const TINTS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
function tint(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * REAL employees (Xodimlar — the people who log into the worker app), shaped
 * as `Worker` so the existing assign picker / detail card render unchanged.
 * Status comes from today's attendance (present/late = online), workload and
 * rating from the murojaat pipeline. Ilgari tanlagich demo "Worker" jadvalini
 * ko'rsatardi — biriktirilgan murojaat xodim ilovasiga hech qachon yetmasdi.
 */
export function useAssignableStaff(): { staff: Worker[]; loading: boolean } {
  const now = new Date();
  const oversight = useOversight(now.getFullYear(), now.getMonth() + 1);
  const stats = useApplicationStats();

  const staff = useMemo<Worker[]>(() => {
    const rows = Array.isArray(oversight.data?.rows) ? oversight.data!.rows : [];
    const perf = new Map((stats.data?.byEmployee ?? []).map((e) => [e.employeeId, e]));
    return rows.map((r) => {
      const p = perf.get(r.employeeId);
      const att = r.attendance.status;
      const atWork = att === 'present' || att === 'late';
      return {
        id: r.employeeId,
        name: r.fullName,
        photo: r.avatarUrl ?? '',
        avatarColor: tint(r.employeeId),
        position: r.position,
        region: r.location.mahallaName ?? "Mirzo Ulug'bek",
        districtId: 'mirzo',
        phone: r.phone,
        email: '',
        specialization: [],
        status: atWork ? 'online' : 'offline',
        insideRegion: r.location.hasLocation && r.location.insideAssignedZone,
        rating: p?.avgRating ?? 0,
        points: 0,
        completedTasks: p?.resolved ?? 0,
        activeTasks: p?.open ?? 0,
        lat: 0,
        lng: 0,
        hiredAt: '',
        checkInTime: r.attendance.checkInAt,
        checkOutTime: r.attendance.checkOutAt,
        todayConfirmed: r.hasFace && atWork,
        attendanceRate: 0,
        onTimeRate: 0,
        monthlyHours: r.attendance.monthHours,
        attendance: [],
      } as unknown as Worker;
    });
  }, [oversight.data, stats.data]);

  return { staff, loading: oversight.isLoading };
}
