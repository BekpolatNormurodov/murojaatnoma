import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

export type DayStatus = 'present' | 'late' | 'absent' | 'left' | 'leave' | 'dayoff';

export interface ProfileDay {
  date: string;
  status: DayStatus;
  checkIn: { time: string; isLate: boolean; lateMinutes: number; photoUrl: string | null } | null;
  checkOut: { time: string; photoUrl: string | null; distanceM?: number } | null;
  hoursWorked: number | null;
}

export interface EmployeeMurojaatSummary {
  assigned: number;
  open: number;
  overdue: number;
  resolved: number;
  rejected: number;
  /** Shu xodim kamida bitta javob yozgan murojaatlar soni. */
  answered: number;
  avgRating: number | null;
  avgFirstReplyHours: number | null;
}

export interface EmployeeProfile {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  phone: string;
  username: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  workStartTime: string;
  workEndTime: string;
  office: { lat: number; lng: number; radiusM: number } | null;
  assignedMahallas: { code: string; name: string }[];
  face: { enrolled: boolean; templates: number; lastAt: string | null };
  live: { at: string; mahallaName: string | null; insideZone: boolean; stale: boolean } | null;
  month: {
    year: number;
    month: number;
    daysWorked: number;
    lateDays: number;
    lateMinutes: number;
    hours: number;
    absentDays: number;
    salaryBase: number | null;
    salaryNet: number | null;
    premya: number;
  };
  attendance: ProfileDay[];
  murojaat: EmployeeMurojaatSummary;
}

export type MurojaatScope = 'all' | 'assigned' | 'answered' | 'resolved';

export interface EmployeeMurojaatRow {
  id: string;
  title: string;
  kind: 'ARIZA' | 'SHIKOYAT';
  category: string | null;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
  citizenName: string;
  createdAt: string;
  dueAt: string | null;
  resolvedAt: string | null;
  rating: number | null;
  reopenCount: number;
  assignedToThem: boolean;
  /** Shu xodim yozgan javoblar soni. */
  replies: number;
  lastReplyAt: string | null;
  overdue: boolean;
}

export interface ArchivedEmployee {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  phone: string;
  username: string | null;
  department: string | null;
  archivedAt: string;
  archiveReason: string | null;
}

/** GET /oversight/employee/:id — xodimning ichki profil sahifasi. */
export function useEmployeeProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['employee-profile', id],
    queryFn: () => api.get<EmployeeProfile>(`/oversight/employee/${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: 20_000,
  });
}

/** Xodimning murojaatlari — kimniki, holat, tur va davr filtri bilan. */
export function useEmployeeMurojaats(
  id: string | undefined,
  f: { scope: MurojaatScope; status?: string; kind?: string; days?: number },
) {
  const qs = new URLSearchParams({ scope: f.scope });
  if (f.status) qs.set('status', f.status);
  if (f.kind) qs.set('kind', f.kind);
  if (f.days) qs.set('days', String(f.days));
  return useQuery({
    queryKey: ['employee-profile', id, 'murojaats', qs.toString()],
    queryFn: () =>
      api.get<EmployeeMurojaatRow[]>(`/oversight/employee/${encodeURIComponent(id!)}/murojaats?${qs}`),
    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

/** Ishdan bo'shatilganlar (arxiv). */
export function useArchivedEmployees(enabled = true) {
  return useQuery({
    queryKey: ['oversight', 'archived'],
    queryFn: () => api.get<ArchivedEmployee[]>('/oversight/archived'),
    enabled,
    staleTime: 30_000,
  });
}

/** Bo'limlar — forma tanlovi. */
export function useDepartments() {
  return useQuery({
    queryKey: ['oversight', 'departments'],
    queryFn: () => api.get<{ id: string; name: string; employees: number }[]>('/oversight/departments'),
    staleTime: 5 * 60_000,
  });
}
