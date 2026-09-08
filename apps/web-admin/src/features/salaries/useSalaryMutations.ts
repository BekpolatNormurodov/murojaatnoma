import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { SalaryRecord } from './useSalaries';

/* Oylik maosh yozish amallari — real backend:
     PUT    /salaries       (belgilash/tahrirlash — upsert)
     DELETE /salaries/:id   (o'chirish)
   Ro'yxat keshi ['salaries', ...] prefiksi bilan (har oy alohida kalit). */

const LIST_PREFIX = ['salaries'] as const;

export interface UpsertSalaryInput {
  employeeId: string;
  year: number;
  month: number;
  amount: number;
  bonus?: number;
  penalty?: number;
  note?: string;
}

export function useUpsertSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSalaryInput) => api.put<SalaryRecord>('/salaries', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/salaries/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}
