import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Bonus } from './useBonuses';

/* ============================================================
   Premyalar (bonuses) yozish amallari — real backend:
     POST   /bonuses      (yaratish)
     PATCH  /bonuses/:id  (tahrirlash)
     DELETE /bonuses/:id  (o'chirish)

   Ro'yxat keshi ['bonuses', ...] prefiksi bilan (useBonuses bilan bir
   xil kalit oilasi — har bir oy filtri alohida kalitda saqlanadi).
   Yaratishdan so'ng barcha variantlar qayta yuklanadi; o'chirish esa
   optimistik — kesh ichidagi barcha ro'yxatlardan darhol olib
   tashlanadi, backend rad etsa avvalgi holatga qaytariladi
   (useStaffMutations / useWorkerMutations namunasi).
   ============================================================ */

const LIST_PREFIX = ['bonuses'] as const;

/** `POST /bonuses` tanasi. `employeeId`/`workerId` — `null` = "manba yo'q"
 *  (erkin nom); ikkalasidan faqat bittasi to'ldiriladi. */
export interface CreateBonusInput {
  recipientName: string;
  amount: number;
  reason: string;
  month: string;
  employeeId?: string | null;
  workerId?: string | null;
}

/** `PATCH /bonuses/:id` tanasi — `id` + o'zgartiriladigan maydonlar. */
export interface UpdateBonusInput extends CreateBonusInput {
  id: string;
}

export function useCreateBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBonusInput) => api.post<Bonus>('/bonuses', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useUpdateBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateBonusInput) => api.patch<Bonus>(`/bonuses/${id}`, body),
    // Optimistik: kesh ichidagi barcha ro'yxatlarda yozuvni darhol almashtiramiz.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: LIST_PREFIX });
      const previous = qc.getQueriesData<Bonus[]>({ queryKey: LIST_PREFIX });
      previous.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<Bonus[]>(
          key,
          data.map((b) =>
            b.id === input.id
              ? {
                  ...b,
                  recipientName: input.recipientName,
                  amount: input.amount,
                  reason: input.reason,
                  month: input.month,
                  employeeId: input.employeeId ?? null,
                  workerId: input.workerId ?? null,
                }
              : b,
          ),
        );
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/bonuses/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST_PREFIX });
      const previous = qc.getQueriesData<Bonus[]>({ queryKey: LIST_PREFIX });
      previous.forEach(([key, data]) => {
        if (data) qc.setQueryData<Bonus[]>(key, data.filter((b) => b.id !== id));
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}
