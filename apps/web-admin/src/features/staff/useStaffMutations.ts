import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  ModuleKey,
  StaffMember,
  StaffRole,
  StaffStatus,
  WorkSchedule,
} from '@/shared/data/types';

/* ============================================================
   Boshqaruv xodimlari (staff) yozish amallari — real backend:
     POST   /staff        (yaratish)
     PATCH  /staff/:id     (tahrirlash)
     DELETE /staff/:id     (o'chirish)

   Ro'yxat keshi ['staff'] (useStaff bilan bir xil kalit).
   O'chirish optimistik (darhol olib tashlanadi, xatoda qaytariladi);
   yaratish/tahrir keshni qayta yuklaydi.
   ============================================================ */

const LIST_KEY = ['staff'] as const;

/** `POST /staff` tanasi — create DTO majburiy + ixtiyoriy maydonlari. */
export interface StaffFormInput {
  name: string;
  photo: string;
  avatarColor: string;
  role: StaffRole;
  position: string;
  department: string;
  email: string;
  phone: string;
  login: string;
  status: StaffStatus;
  permissions: ModuleKey[];
  schedule: WorkSchedule;
  twoFactor: boolean;
}

/** `PATCH /staff/:id` — drawer'da tahrirlanadigan maydonlar. */
export interface StaffUpdateInput {
  role?: StaffRole;
  status?: StaffStatus;
  login?: string;
  permissions?: ModuleKey[];
  schedule?: WorkSchedule;
  twoFactor?: boolean;
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffFormInput) => api.post<StaffMember>('/staff', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: StaffUpdateInput & { id: string }) =>
      api.patch<StaffMember>(`/staff/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/staff/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<StaffMember[]>(LIST_KEY);
      if (prev) {
        qc.setQueryData<StaffMember[]>(
          LIST_KEY,
          prev.filter((s) => s.id !== id),
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
