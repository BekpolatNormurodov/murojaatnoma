import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AdminRole } from '@/shared/store/auth';

/**
 * Backend profil shakli — GET/POST/PATCH /auth/admin/users bilan bir xil
 * (`passwordHash` hech qachon qaytmaydi). Faqat SUPER_ADMIN token bilan
 * ochiladi (ADMIN/VIEWER/anon -> 403).
 */
export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Adminlar ro'yxati: GET /auth/admin/users (faqat SUPER_ADMIN). */
export function useAdmins() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUser[]>('/auth/admin/users'),
    staleTime: 15_000,
  });
}
