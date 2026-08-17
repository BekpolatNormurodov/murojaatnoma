import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AttendanceMonthlyReport } from './api/types';

/**
 * Oylik davomat hisobotini oladi: GET /api/attendance/report/monthly?year=&month=
 * Har bir xodim bo'yicha kechikish soni/daqiqasi va shu oy davomida hech
 * qachon kelmagan (0 ta valid check-in) xodimlar ro'yxatini beradi.
 *
 * Kunlik (14 kunlik) trend endpoint mavjud emasligi sababli, davomat
 * sahifasidagi "trend" bo'limi shu oylik agregatlardan hosil qilinadi —
 * kunma-kun grafik emas, balki oylik jami ko'rsatkichlar sifatida.
 */
export function useAttendanceMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', 'report', 'monthly', year, month],
    queryFn: () =>
      api.get<AttendanceMonthlyReport>(`/attendance/report/monthly?year=${year}&month=${month}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
