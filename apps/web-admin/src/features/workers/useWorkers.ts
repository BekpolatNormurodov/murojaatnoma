import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Worker } from '@/shared/data/types';

/**
 * Dala ishchilari ro'yxatini backend'dan oladi: GET /api/workers
 * Javob shakli mock'dagi `WORKERS: Worker[]` bilan bir xil (drop-in).
 */
export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    queryFn: () => api.get<Worker[]>('/workers'),
    staleTime: 30_000,
  });
}
