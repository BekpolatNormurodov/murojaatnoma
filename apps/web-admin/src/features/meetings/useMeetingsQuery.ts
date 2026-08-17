import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Meeting } from '@/shared/data/types';

/**
 * Yig'ilishlar ro'yxatini backend'dan oladi: GET /api/meetings
 * Javob shakli mock'dagi `MEETINGS: Meeting[]` bilan bir xil (drop-in).
 *
 * Natija `useMeetings` (Zustand) do'koniga yoziladi — sahifadagi
 * qo'shish/tahrirlash amallari o'sha do'kon ustida ishlaydi, chunki
 * bu amallar uchun hozircha backend endpoint mavjud emas.
 */
export function useMeetingsQuery() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.get<Meeting[]>('/meetings'),
    staleTime: 30_000,
  });
}
