import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AdminRole } from '@/shared/store/auth';
import type { AdminUser } from './useAdmins';

/* ============================================================
   Adminlar (web-admin akkauntlari) yozish amallari — real backend:
     POST   /auth/admin/users        (yaratish)
     PATCH  /auth/admin/users/:id    (tahrirlash)
     DELETE /auth/admin/users/:id    (o'chirish)

   Faqat SUPER_ADMIN token bilan ochiladi. Backend lockout qoidalari
   (o'zini o'zgartira/o'chira olmaslik, oxirgi faol SUPER_ADMIN'ni
   pasaytira/faolsizlantira/o'chira olmaslik) 400 bilan qaytadi —
   xabar ApiError.message orqali chaqiruvchi tomonda ko'rsatiladi.

   Ro'yxat keshi ['admin-users'] (useAdmins bilan bir xil kalit).
   ============================================================ */

const LIST_KEY = ['admin-users'] as const;

/** `POST /auth/admin/users` tanasi. */
export interface AdminCreateInput {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  role: AdminRole;
}

/** `PATCH /auth/admin/users/:id` tanasi — hammasi ixtiyoriy. */
export interface AdminUpdateInput {
  fullName?: string;
  email?: string;
  role?: AdminRole;
  isActive?: boolean;
  password?: string;
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateInput) => api.post<AdminUser>('/auth/admin/users', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: AdminUpdateInput & { id: string }) =>
      api.patch<AdminUser>(`/auth/admin/users/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/auth/admin/users/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<AdminUser[]>(LIST_KEY);
      if (prev) {
        qc.setQueryData<AdminUser[]>(
          LIST_KEY,
          prev.filter((a) => a.id !== id),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
