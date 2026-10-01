import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/** Create/edit an employee (person) from Nazorat. Matches POST/PATCH /oversight/employee. */
export interface EmployeeInput {
  fullName: string;
  position: string;
  phone?: string;
  username?: string;
  password?: string;
  avatarUrl?: string;
  salary?: number;
  assignedMahallaCodes?: string[];
}

/** Upload a photo (POST /uploads, field "file") → returns the public URL. */
export async function uploadPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.upload<{ url: string }>('/uploads', fd);
  return res.url;
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) =>
      api.post<{ id: string; fullName: string; username: string | null }>('/oversight/employee', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['oversight'] });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: EmployeeInput & { id: string }) =>
      api.patch<{ id: string; fullName: string }>(`/oversight/employee/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['oversight'] });
    },
  });
}

/** O'chirish — DELETE /employees/:id. Ortga qaytarib bo'lmaydi (confirm bilan). */
export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/employees/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['oversight'] });
    },
  });
}
