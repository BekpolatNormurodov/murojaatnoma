import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Deputy, RequestCategory } from '@/shared/data/types';

/* ============================================================
   Hokim o'rinbosarlari (deputies) yozish amallari — real backend:
     POST   /deputies        (yaratish)
     PATCH  /deputies/:id     (tahrirlash)
     DELETE /deputies/:id     (o'chirish)

   Ro'yxat keshi ['deputies'] (useDeputies bilan bir xil kalit).
   O'chirish optimistik (darhol olib tashlanadi, xatoda qaytariladi);
   yaratish/tahrir keshni qayta yuklaydi.
   ============================================================ */

const LIST_KEY = ['deputies'] as const;

/** `POST /deputies` / `PATCH /deputies/:id` tanasi — create DTO maydonlari. */
export interface DeputyFormInput {
  name: string;
  photo: string;
  color: string;
  position: string;
  direction: string;
  shortDirection: string;
  categories: RequestCategory[];
  topics: string[];
  phone: string;
  email: string;
  office: string;
  receptionDay: string;
}

export function useCreateDeputy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeputyFormInput) => api.post<Deputy>('/deputies', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateDeputy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<DeputyFormInput> & { id: string }) =>
      api.patch<Deputy>(`/deputies/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteDeputy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/deputies/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<Deputy[]>(LIST_KEY);
      if (prev) {
        qc.setQueryData<Deputy[]>(
          LIST_KEY,
          prev.filter((d) => d.id !== id),
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
