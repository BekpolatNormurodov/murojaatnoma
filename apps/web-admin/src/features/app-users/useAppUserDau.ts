import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AppUserDauPoint } from './api/types';

/** So'nggi 14 kunlik kunlik faol foydalanuvchilar (DAU): GET /api/app-users/dau */
export function useAppUserDau() {
  return useQuery({
    queryKey: ['app-users', 'dau'],
    queryFn: () => api.get<AppUserDauPoint[]>('/app-users/dau'),
    staleTime: 30_000,
  });
}
