import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { RequestCategory, Worker, WorkerStatus } from '@/shared/data/types';

/* ============================================================
   Dala ishchilari (workers) yozish amallari — backend'ga real
   so'rov yuboradi:
     POST   /workers        (yaratish)
     PATCH  /workers/:id    (tahrirlash)
     DELETE /workers/:id    (o'chirish)

   Ro'yxat keshi ['workers'] (useWorkers bilan bir xil kalit)
   yaratish/tahrirdan so'ng qayta yuklanadi; o'chirish esa
   optimistik — ro'yxatdan darhol olib tashlanadi, backend rad
   etsa avvalgi holatga qaytariladi (complaints deleteComplaint
   namunasi, React Query keshida).
   ============================================================ */

const LIST_KEY = ['workers'] as const;

/** `POST /workers` / `PATCH /workers/:id` tanasi — create DTO maydonlari. */
export interface WorkerFormInput {
  name: string;
  photo: string;
  avatarColor: string;
  position: string;
  region: string;
  districtId: string;
  phone: string;
  email: string;
  specialization: RequestCategory[];
  status: WorkerStatus;
  salary: number;
  vehicle: string | null;
}

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkerFormInput) => api.post<Worker>('/workers', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<WorkerFormInput> & { id: string }) =>
      api.patch<Worker>(`/workers/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/workers/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<Worker[]>(LIST_KEY);
      if (prev) {
        qc.setQueryData<Worker[]>(
          LIST_KEY,
          prev.filter((w) => w.id !== id),
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
