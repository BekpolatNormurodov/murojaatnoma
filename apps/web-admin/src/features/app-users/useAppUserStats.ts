import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AppUserStats } from './api/types';

/** Ilova foydalanuvchilari bo'yicha umumiy statistika: GET /api/app-users/stats */
export function useAppUserStats() {
  return useQuery({
    queryKey: ['app-users', 'stats'],
    queryFn: () => api.get<AppUserStats>('/app-users/stats'),
    staleTime: 30_000,
  });
}
