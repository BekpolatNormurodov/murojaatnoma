import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/* ───────────── Hududda yurgan vaqt ───────────── */

/** Bir xil holatdagi uzluksiz oraliq (hududda yoki tashqarida). */
export interface ZoneStretch {
  from: string;
  to: string;
  minutes: number;
  inside: boolean;
  mahallaName: string | null;
}

/** Bir kunda bitta mahallada o'tgan vaqt. */
export interface MahallaTime {
  /** null — hech bir mahallaga tushmagan (tuman tashqarisi). */
  name: string | null;
  minutes: number;
  /** Shu vaqt biriktirilgan hudud hisoblanganmi. */
  inside: boolean;
}

export interface ZoneDay {
  /** "YYYY-MM-DD" */
  date: string;
  zoneMinutes: number;
  outsideMinutes: number;
  /** Lokatsiya kelib turgan jami vaqt (hududda + tashqarida). */
  activeMinutes: number;
  firstAt: string | null;
  lastAt: string | null;
  stretches: ZoneStretch[];
  /** Mahallalar bo'yicha taqsimot, ko'pi birinchi (eski backend'da bo'lmasligi mumkin). */
  byMahalla?: MahallaTime[];
}

export interface ZoneTime {
  /** Shuncha daqiqadan uzun sukunat "uzilish" hisoblanadi. */
  gapMinutes: number;
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

/** GET /daily-reports — davr (va ixtiyoriy bitta xodim) bo'yicha, yangi birinchi. */
export function useDailyReports(q: { from: string; to: string; employeeId?: string }, enabled = true) {
  const qs = new URLSearchParams({ from: q.from, to: q.to });
  if (q.employeeId) qs.set('employeeId', q.employeeId);
  return useQuery({
    queryKey: ['daily-reports', q.from, q.to, q.employeeId ?? 'all'],
    queryFn: () => api.get<DailyReport[]>(`/daily-reports?${qs}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
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
}

export interface Activity {
  from: string;
  to: string;
  rows: ActivityRow[];
}

export const fetchActivity = (from: string, to: string) =>
  api.get<Activity>(`/daily-reports/activity?from=${from}&to=${to}`);

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

/* ───────────── Sana / vaqt yordamchilari ───────────── */

/** Mahalliy kun "YYYY-MM-DD" (bugundan `offset` kun). */
export function localDay(offset = 0, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Tanlangan oyning davri; joriy oy bo'lsa — bugungacha, kelajak oy — bo'sh emas, 1-kun. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(last)}`;
  const today = localDay();
  return { from, to: end > today ? (today < from ? from : today) : end };
}

/** 135 → "2 soat 15 daq"; 0 → "0 daq". */
export function durationText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} daq`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} soat ${rest} daq` : `${h} soat`;
}

/** Excel uchun: daqiqa → soat, bitta kasr (135 → 2.3). */
export function hoursOf(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/** ISO → "09:12" (mahalliy). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
