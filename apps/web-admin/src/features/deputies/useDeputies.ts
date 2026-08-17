import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Deputy } from '@/shared/data/types';

/**
 * Hokim o'rinbosarlari ro'yxatini backend'dan oladi: GET /api/deputies
 * Javob shakli mock'dagi `DEPUTIES: Deputy[]` bilan bir xil (drop-in).
 */
export function useDeputies() {
  return useQuery({
    queryKey: ['deputies'],
    queryFn: () => api.get<Deputy[]>('/deputies'),
    staleTime: 60_000,
  });
}
