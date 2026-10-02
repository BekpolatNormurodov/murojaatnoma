import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

export type TimesheetStatus = 'present' | 'late' | 'left' | 'absent' | 'leave' | 'dayoff' | 'future';

export interface TimesheetCell {
  date: string;
  status: TimesheetStatus;
  in: string | null;
  out: string | null;
  hours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  excused: boolean;
  leave: string | null;
}

export interface TimesheetRow {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  avatarUrl: string | null;
  workStartTime: string;
  workEndTime: string;
  cells: TimesheetCell[];
  totals: {
    workdays: number;
    came: number;
    late: number;
    lateMinutes: number;
    earlyLeaves: number;
    earlyMinutes: number;
    absent: number;
    leave: number;
    hours: number;
    normHours: number;
  };
}

export interface Timesheet {
  from: string;
  to: string;
  days: { date: string; weekday: number; isWorkday: boolean; isToday: boolean; isFuture: boolean }[];
  rows: TimesheetRow[];
  daily: { date: string; came: number; expected: number }[];
}

/** GET /attendance/timesheet — barcha xodimlar × davr kunlari (≤ 62 kun). */
export function useTimesheet(from: string, to: string) {
  return useQuery({
    queryKey: ['attendance', 'timesheet', from, to],
    queryFn: () =>
      api.get<Timesheet>(`/attendance/timesheet?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
