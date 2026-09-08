import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/** One month's salary for an employee (net = amount + bonus - penalty). */
export interface SalaryRecord {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  amount: number;
  bonus: number;
  penalty: number;
  net: number;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row in the monthly roster — `salary` is null when none is set yet. */
export interface SalaryRosterRow {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  salary: SalaryRecord | null;
}

export interface SalaryRoster {
  year: number;
  month: number;
  rows: SalaryRosterRow[];
  totalNet: number;
}

/**
 * Oylik maosh jadvali (tanlangan oy uchun har bir xodim): GET /api/salaries.
 * Har oy alohida kesh kaliti bilan saqlanadi (['salaries', year, month]).
 */
export function useSalaries(year: number, month: number) {
  return useQuery({
    queryKey: ['salaries', year, month],
    queryFn: () => api.get<SalaryRoster>(`/salaries?year=${year}&month=${month}`),
    staleTime: 30_000,
  });
}

/**
 * Bitta xodimning butun oylik tarixi (eng yangi oy birinchi):
 * GET /api/salaries/employee/:id. Drawer ochilgandagina so'raladi (`enabled`).
 */
export function useSalaryHistory(employeeId: string | null) {
  return useQuery({
    queryKey: ['salaries', 'history', employeeId],
    queryFn: () => api.get<SalaryRecord[]>(`/salaries/employee/${employeeId}`),
    enabled: !!employeeId,
    staleTime: 30_000,
  });
}
