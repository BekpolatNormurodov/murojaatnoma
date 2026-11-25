import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { nextReportOffset, REPORT_PAGE_SIZE } from './reportPages';

export { clock, localDay } from './period';

/* ───────────── Hududda yurgan vaqt ───────────── */

/** Bir xil holatdagi uzluksiz oraliq (hududda, ofisda yoki tashqarida). */
export interface ZoneStretch {
  from: string;
  to: string;
  minutes: number;
  inside: boolean;
  /** Hududda emas, lekin ofisda (eski backend'da yo'q). */
  office?: boolean;
  mahallaName: string | null;
}

/** Bir kunda bitta mahallada o'tgan vaqt. */
export interface MahallaTime {
  /** null — hech bir mahallaga tushmagan (tuman tashqarisi). */
  name: string | null;
  minutes: number;
  /** Shu vaqt biriktirilgan hudud hisoblanganmi. */
  inside: boolean;
  /** Hududda emas, lekin ofisda (eski backend'da yo'q). */
  office?: boolean;
}

export interface ZoneDay {
  /** "YYYY-MM-DD" */
  date: string;
  zoneMinutes: number;
  /** Hududdan tashqarida, lekin ofisda (eski backend'da yo'q). */
  officeMinutes?: number;
  outsideMinutes: number;
  /** Lokatsiya kelib turgan jami vaqt (hududda + ofisda + tashqarida). */
  activeMinutes: number;
  /** Faqat ish jadvali oralig'idagi qismi (eski backend'da yo'q). */
  workZoneMinutes?: number;
  workActiveMinutes?: number;
  firstAt: string | null;
  lastAt: string | null;
  stretches: ZoneStretch[];
  /** Mahallalar bo'yicha taqsimot, ko'pi birinchi (eski backend'da bo'lmasligi mumkin). */
  byMahalla?: MahallaTime[];
}

export interface ZoneTime {
  /** Shuncha daqiqadan uzun sukunat "uzilish" hisoblanadi. */
  gapMinutes: number;
  workStartTime?: string;
  workEndTime?: string;
  /** Yangi kun birinchi; so'ralgan har bir kun bor (bo'sh kunlar ham). */
  days: ZoneDay[];
}

/** GET /daily-reports/employee/:id/zone-time — kunma-kun, vaqt oraliqlari bilan. */
export function useZoneTime(id: string | undefined, days: number) {
  return useQuery({
    queryKey: ['employee-profile', id, 'zone-time', days],
    queryFn: () => api.get<ZoneTime>(`/daily-reports/employee/${encodeURIComponent(id!)}/zone-time?days=${days}`),
    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/* ───────────── Kunlik hisobotlar ───────────── */

export type ReportAttachmentKind = 'image' | 'voice' | 'video' | 'file';

export interface ReportAttachment {
  kind: ReportAttachmentKind;
  url: string;
  fileName: string | null;
  fileSize: number | null;
  durationSec: number | null;
}

export interface DailyReport {
  id: string;
  employeeId: string;
  /** Hisobot qaysi kun uchun, "YYYY-MM-DD". */
  day: string;
  text: string | null;
  attachments: ReportAttachment[];
  createdAt: string;
  employee?: { fullName: string; position: string; avatarUrl: string | null };
}

/**
 * GET /daily-reports — davr (va ixtiyoriy bitta xodim) bo'yicha, yangi birinchi.
 * Sahifalab yuklanadi (limit/offset); yangi hisobotlar har daqiqada keladi.
 */
export function useDailyReports(q: { from: string; to: string; employeeId?: string }, enabled = true) {
  const qs = new URLSearchParams({ from: q.from, to: q.to });
  if (q.employeeId) qs.set('employeeId', q.employeeId);
  qs.set('limit', String(REPORT_PAGE_SIZE));
  return useInfiniteQuery({
    queryKey: ['daily-reports', q.from, q.to, q.employeeId ?? 'all'],
    queryFn: ({ pageParam }) => api.get<DailyReport[]>(`/daily-reports?${qs}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (_last, pages) => nextReportOffset(pages),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/* ───────────── Davr yakuni (ro'yxat nishonlari + Excel) ───────────── */

export interface ActivityRow {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  avatarUrl: string | null;
  /** Biriktirilgan mahallalar nomi (bo'sh = butun tuman). */
  mahallas: string[];
  workStartTime: string;
  workEndTime: string;
  reportDays: number;
  reportCount: number;
  zoneMinutes: number;
  activeMinutes: number;
  /** Davomat bo'yicha ish vaqti (keldi → ketdi), daqiqa. */
  workMinutes: number;
  daysWorked: number;
  // Quyidagilar yangi backend'da; eskisida yo'q.
  officeMinutes?: number;
  workZoneMinutes?: number;
  workActiveMinutes?: number;
  /** Kelgan, lekin "ketdi" belgilanmagan kunlar (bugun hisoblanmaydi). */
  missingCheckOutDays?: number;
  archived?: boolean;
}

export interface Activity {
  from: string;
  to: string;
  rows: ActivityRow[];
}

export const fetchActivity = (from: string, to: string) =>
  api.get<Activity>(`/daily-reports/activity?from=${from}&to=${to}`);

export interface ActivityDailyDay {
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number;
  reportCount: number;
  zoneMinutes: number;
  officeMinutes: number;
  outsideMinutes: number;
  activeMinutes: number;
  workZoneMinutes: number;
  workActiveMinutes: number;
  firstAt: string | null;
  lastAt: string | null;
  stretches: ZoneStretch[];
}

export interface ActivityDailyRow {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  mahallas: string[];
  workStartTime: string;
  workEndTime: string;
  archived: boolean;
  /** Eski kun birinchi; davrdagi har bir kun bor. */
  days: ActivityDailyDay[];
}

export interface ActivityDaily {
  from: string;
  to: string;
  gapMinutes: number;
  rows: ActivityDailyRow[];
}

/** GET /daily-reports/activity/daily — xodim × kun (ko'pi bilan 31 kun). */
export const fetchActivityDaily = (from: string, to: string) =>
  api.get<ActivityDaily>(`/daily-reports/activity/daily?from=${from}&to=${to}`);

/** GET /daily-reports/activity — har bir xodim bo'yicha davr yakuni. */
export function useActivity(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['daily-reports', 'activity', from, to],
    queryFn: () => fetchActivity(from, to),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/* ───────────── Davomat sozlamasi ───────────── */

export interface AttendanceSettings {
  /** false — keldi/ketdi yuz skanerisiz, faqat joy bo'yicha qabul qilinadi. */
  faceRequired: boolean;
}

export function useAttendanceSettings() {
  return useQuery({
    queryKey: ['settings', 'attendance'],
    queryFn: () => api.get<AttendanceSettings>('/settings/attendance'),
    staleTime: 30_000,
  });
}

export function useUpdateAttendanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AttendanceSettings>) => api.patch<AttendanceSettings>('/settings/attendance', patch),
    onSuccess: (data) => {
      qc.setQueryData(['settings', 'attendance'], data);
    },
  });
}

/* ───────────── Vaqt / fayl yordamchilari ───────────── */

/** 135 → "2 soat 15 daqiqa"; 0 → "0 daqiqa". */
export function durationText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} daqiqa`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} soat ${rest} daqiqa` : `${h} soat`;
}

/** 1536 → "1,5 KB". */
export function fileSizeText(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 75 → "1:15". */
export function mediaLength(sec: number | null): string {
  if (sec == null || sec < 0) return '';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}
