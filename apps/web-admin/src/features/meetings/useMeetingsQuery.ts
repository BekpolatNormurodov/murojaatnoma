import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Meeting } from '@/shared/data/types';

/**
 * Yig'ilishlar ro'yxatini backend'dan oladi: GET /api/meetings
 * Javob shakli mock'dagi `MEETINGS: Meeting[]` bilan bir xil (drop-in).
 *
 * Natija `useMeetings` (Zustand) do'koniga yoziladi — sahifadagi
 * qo'shish/tahrirlash/o'chirish amallari o'sha do'kon ustida ishlaydi
 * (POST/PATCH/DELETE /meetings orqali real backendga ulangan).
 */
export function useMeetingsQuery() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.get<Meeting[]>('/meetings'),
    staleTime: 30_000,
  });
}
