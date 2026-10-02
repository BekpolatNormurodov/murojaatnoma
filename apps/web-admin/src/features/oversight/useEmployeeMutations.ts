import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/** Create/edit an employee (person) from Nazorat. Matches POST/PATCH /oversight/employee. */
export interface EmployeeInput {
  fullName: string;
  position: string;
  phone?: string;
  username?: string;
  password?: string;
  /** null = remove the photo (edit). */
  avatarUrl?: string | null;
  salary?: number;
  /** Which month `salary` is for (the month the page is viewing). */
  salaryYear?: number;
  salaryMonth?: number;
  assignedMahallaCodes?: string[];
  /** Bo'lim nomi ('' = bo'limsiz; yangi nom yaratiladi). */
  department?: string;
  workStartTime?: string;
  workEndTime?: string;
  /** Shaxsiy ofis nuqtasi; null = umumiy ofis. */
  officeLat?: number | null;
  officeLng?: number | null;
  officeRadiusM?: number | null;
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
      void qc.invalidateQueries({ queryKey: ['employee-profile'] });
    },
  });
}

/** Har bir o'zgarishdan keyin ro'yxat, arxiv va profil yangilanadi. */
function useEmployeeInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['oversight'] });
    void qc.invalidateQueries({ queryKey: ['employee-profile'] });
  };
}

/** Ishdan bo'shatish (arxivga) — tarix saqlanadi, login yopiladi. */
export function useArchiveEmployee() {
  const done = useEmployeeInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<{ id: string; releasedMurojaats: number }>(`/oversight/employee/${id}/archive`, { reason }),
    onSuccess: done,
  });
}

/** Arxivdan qaytarish. */
export function useRestoreEmployee() {
  const done = useEmployeeInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/oversight/employee/${id}/restore`),
    onSuccess: done,
  });
}

/** Butunlay o'chirish — faqat arxivdagi xodim (SUPER_ADMIN). */
export function usePurgeEmployee() {
  const done = useEmployeeInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/oversight/employee/${id}`),
    onSuccess: done,
  });
}

/** Yuzni qayta o'rnatish — xodim ilovada yuzini qaytadan ro'yxatdan o'tkazadi. */
export function useResetFace() {
  const done = useEmployeeInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del<{ removed: number }>(`/oversight/employee/${id}/face`),
    onSuccess: done,
  });
}
