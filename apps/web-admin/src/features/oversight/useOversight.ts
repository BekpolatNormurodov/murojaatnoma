import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'left';

export interface OversightRow {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  hasFace: boolean;
  attendance: {
    status: AttendanceStatus;
    checkInAt: string | null;
    checkOutAt: string | null;
    isLate: boolean;
    /** Bugun necha soat. */
    hoursWorked: number | null;
    /** Bu oy jami necha soat. */
    monthHours: number;
  };
  location: {
    hasLocation: boolean;
    insideAssignedZone: boolean;
    mahallaName: string | null;
    isStale: boolean;
  };
  assignedMahallaCodes: string[];
  salaryNet: number | null;
  /** Bu oy jami premya (bonus), so'm. */
  premyaThisMonth: number;
}

export interface OversightSummary {
  total: number;
  faceEnrolled: number;
  presentNow: number;
  lateNow: number;
  outsideZone: number;
  salaryTotalNet: number;
}

export interface OversightData {
  year: number;
  month: number;
  rows: OversightRow[];
  summary: OversightSummary;
}

/**
 * Hokimiyat nazorati — har bir xodimning face + keldi-ketdi/soat + hudud +
 * oylik holati bitta jadvalda: GET /api/oversight. Jonli ma'lumot bo'lgani
 * uchun tez-tez yangilanadi (30s stale, oyna faollashganda qayta so'raladi).
 */
export function useOversight(year: number, month: number) {
  return useQuery({
    queryKey: ['oversight', year, month],
    queryFn: () => api.get<OversightData>(`/oversight?year=${year}&month=${month}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
