import { MEETING_STATUS_META, MEETING_TYPE_META } from '@/shared/data/mock';
import type { MeetingStatus, MeetingType } from '@/shared/data/types';

/**
 * Yig'ilish turi/holati uchun "guarded" meta qidiruv — MeetingsPage va
 * MeetingDetail ikkalasida ham ishlatiladi. Backend kelajakda yangi
 * tur/holat qo'shsa (MEETING_TYPE_META/MEETING_STATUS_META'da yo'q),
 * UI qulab tushmasligi uchun neytral zaxira qiymat qaytariladi.
 */
const DEFAULT_MEETING_TYPE_META = { label: 'Boshqa', color: '#64748b' };
const DEFAULT_MEETING_STATUS_META = { label: "Noma'lum", tone: 'neutral' as const };

export function meetingTypeMeta(type: MeetingType) {
  return MEETING_TYPE_META[type] ?? DEFAULT_MEETING_TYPE_META;
}

export function meetingStatusMeta(status: MeetingStatus) {
  return MEETING_STATUS_META[status] ?? DEFAULT_MEETING_STATUS_META;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const toTimeInput = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** ISO sanadan "HH:mm" boshlanish vaqtini oladi. */
export function timeLabel(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
}

/** Boshlanish + davomiylikdan "HH:mm" tugash vaqtini hisoblaydi. */
export function endTimeLabel(iso: string, durationMin: number): string {
  const end = new Date(new Date(iso).getTime() + durationMin * 60_000);
  return `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

const WEEKDAYS_UZ = [
  'Yakshanba',
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
];

/** Hafta kuni nomi bilan to'liq sana: "Chorshanba, 12 Iyun 2026". */
export function weekdayDate(iso: string, formatDate: (iso: string) => string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return `${WEEKDAYS_UZ[d.getDay()]}, ${formatDate(iso)}`;
}
