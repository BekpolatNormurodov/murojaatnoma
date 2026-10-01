import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

export interface DayStat {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hours: number;
  late: boolean;
  lateMinutes: number;
}

export interface EmployeePeriodStats {
  employeeId: string;
  fullName: string;
  position: string;
  from: string;
  to: string;
  totalHours: number;
  daysPresent: number;
  daysLate: number;
  totalLateMinutes: number;
  days: DayStat[];
}

export type StatsPeriod = 'thisMonth' | 'lastMonth' | 'last7';

/** Resolve a named period to an ISO from/to range (local time). */
export function periodRange(period: StatsPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  if (period === 'last7') {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: now.toISOString(), label: "Oxirgi 7 kun" };
  }
  if (period === 'lastMonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString(), label: "O'tgan oy" };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { from: from.toISOString(), to: now.toISOString(), label: 'Bu oy' };
}

/**
 * Bitta xodimning davr bo'yicha davomat statistikasi: GET /employee-stats/:id.
 * Faqat drawer ochilganda (employeeId bor bo'lganda) so'raladi.
 */
export function useEmployeeStats(employeeId: string | null, period: StatsPeriod) {
  // periodRange() uses `new Date()`, so it MUST be memoized on `period` — otherwise
  // `to` changes every render, the queryKey churns, and the query refetches in an
  // infinite loop (200+ req/s). Snapshot the range once per period selection.
  const { from, to } = useMemo(() => periodRange(period), [period]);
  return useQuery({
    queryKey: ['employee-stats', employeeId, from, to],
    queryFn: () =>
      api.get<EmployeePeriodStats>(
        `/employee-stats/${employeeId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: !!employeeId,
    staleTime: 30_000,
  });
}
