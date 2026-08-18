import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AttendanceMonthlyReport } from './api/types';

/**
 * Oraliq (interval) davomat hisoboti: GET /api/attendance/report/range?from=&to=
 * Har bir xodim bo'yicha oraliq ichidagi jami skanlar, kelgan/kechikkan
 * sonlari va oraliq davomida umuman kelmagan (0 ta valid CHECK_IN) xodimlar.
 * Javob shakli oylik hisobot bilan bir xil (AttendanceMonthlyReport).
 *
 * `enabled` — faqat ko'p kunlik oraliq tanlanganda so'raladi (bitta kunlik
 * ko'rinish `useAttendanceToday`'ni ishlatadi).
 */
export function useAttendanceRangeReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['attendance', 'report', 'range', from, to],
    queryFn: () =>
      api.get<AttendanceMonthlyReport>(
        `/attendance/report/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: enabled && !!from && !!to,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
