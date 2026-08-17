import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Camera } from '@/shared/data/types';

/**
 * Kuzatuv kameralari ro'yxatini backend'dan oladi: GET /api/cameras
 * Javob shakli mock'dagi `CAMERAS: Camera[]` bilan bir xil (drop-in).
 */
export function useCameras() {
  return useQuery({
    queryKey: ['cameras'],
    queryFn: () => api.get<Camera[]>('/cameras'),
    staleTime: 30_000,
  });
}
