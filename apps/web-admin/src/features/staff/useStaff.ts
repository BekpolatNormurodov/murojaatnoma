import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { StaffMember } from '@/shared/data/types';

/**
 * Boshqaruv xodimlari ro'yxatini backend'dan oladi: GET /api/staff
 * Javob shakli mock'dagi `STAFF: StaffMember[]` bilan bir xil (drop-in).
 */
export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<StaffMember[]>('/staff'),
    staleTime: 30_000,
  });
}
