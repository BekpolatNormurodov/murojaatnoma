import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AppUser, Paginated } from './api/types';

/**
 * Ilova foydalanuvchilari ro'yxatini backend'dan oladi: GET /api/app-users
 *
 * Sahifadagi qidiruv/filtr/saralash hammasi klient tomonda ishlaydi (mock
 * davridagi kabi), shuning uchun bitta so'rovda backend ruxsat bergan
 * maksimal `limit=100` bilan to'liq ro'yxatni olamiz.
 */
export function useAppUsers() {
  return useQuery({
    queryKey: ['app-users', 'list'],
    queryFn: () => api.get<Paginated<AppUser>>('/app-users?limit=100'),
    staleTime: 30_000,
  });
}
