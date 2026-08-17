import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AppUserGrowthPoint } from './api/types';

/** Oylik ro'yxatdan o'tish o'sishi (so'nggi 8 oy): GET /api/app-users/growth */
export function useAppUserGrowth() {
  return useQuery({
    queryKey: ['app-users', 'growth'],
    queryFn: () => api.get<AppUserGrowthPoint[]>('/app-users/growth'),
    staleTime: 30_000,
  });
}
