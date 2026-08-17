import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { TodayAttendance } from './api/types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Joriy sana "yyyy-mm-dd" ko'rinishida, mahalliy vaqt bo'yicha. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Bitta kunlik davomat jadvalini (davomat taxtasi) backend'dan oladi:
 * GET /api/attendance/today?date=yyyy-mm-dd
 *
 * `date` berilmasa — bugungi kun. Sana o'zgarganda oldingi natija ekranda
 * qoladi (keepPreviousData), shu bilan bo'sh skeleton miltillashi oldini oladi.
 */
export function useAttendanceToday(date?: string) {
  const resolvedDate = date ?? todayIso();
  return useQuery({
    queryKey: ['attendance', 'today', resolvedDate],
    queryFn: () =>
      api.get<TodayAttendance>(`/attendance/today?date=${encodeURIComponent(resolvedDate)}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
