import type { EmployeeTodayEntry, TodayAttendanceStatus } from './api/types';

/** Har bir davomat holati uchun o'zbekcha yorliq va Badge rangi. */
export const ATTENDANCE_STATUS_META: Record<
  TodayAttendanceStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' }
> = {
  present: { label: 'Keldi', tone: 'success' },
  late: { label: 'Kechikdi', tone: 'warning' },
  absent: { label: 'Kelmadi', tone: 'danger' },
  left: { label: 'Ketdi', tone: 'info' },
  leave: { label: "Ta'tilda", tone: 'primary' },
  dayoff: { label: 'Dam olish', tone: 'neutral' },
};

/** "Ta'til: Mehnat ta'tili" / "Ruxsat 09:00–11:00: Shifokorga". */
export function leaveText(l: { type: 'days' | 'hours'; reason: string; from?: string; to?: string }): string {
  return l.type === 'days' ? `Ta'til: ${l.reason}` : `Ruxsat ${l.from ?? ''}–${l.to ?? ''}: ${l.reason}`;
}

/** "08:52" — local wall-clock time. */
export function clockOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function distanceText(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function minutesText(min: number): string {
  if (min < 60) return `${min} daq`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} daq` : `${h} soat`;
}

export function hoursText(h: number): string {
  const total = Math.round(h * 60);
  const m = total % 60;
  return m ? `${Math.floor(total / 60)} soat ${m} daq` : `${Math.floor(total / 60)} soat`;
}

/**
 * Backend rad etish sababini ("face score 0.42 below threshold 0.7; 1234m from
 * office, outside 200m geofence") odam o'qiydigan o'zbekchaga aylantiradi.
 */
export function humanizeScanReason(reason: string | null): string {
  if (!reason) return 'Tasdiqlanmadi';
  return reason
    .split(';')
    .map((part) => {
      const p = part.trim();
      if (/no enrolled face/i.test(p)) return 'Yuz namunasi kiritilmagan';
      const face = p.match(/face score ([\d.]+) below threshold ([\d.]+)/i);
      if (face) {
        return `Yuz mos kelmadi (${Math.round(Number(face[1]) * 100)}%, kerak ${Math.round(
          Number(face[2]) * 100,
        )}%)`;
      }
      const geo = p.match(/([\d.]+)m from office, outside ([\d.]+)m geofence/i);
      if (geo) {
        return /mahalla/i.test(p)
          ? `Ofisdan ${distanceText(Number(geo[1]))} uzoqda va biriktirilgan mahallasida emas`
          : `Ofisdan ${distanceText(Number(geo[1]))} uzoqda (ruxsat ${geo[2]} m)`;
      }
      return p;
    })
    .join(' · ');
}

/** Bir kunlik "harakat" — keldi / ketdi / rad etilgan urinish (jonli lenta uchun). */
export interface AttendanceEvent {
  key: string;
  kind: 'in' | 'out' | 'failed';
  time: string;
  entry: EmployeeTodayEntry;
  note: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

export function attendanceEvents(roster: EmployeeTodayEntry[]): AttendanceEvent[] {
  const events: AttendanceEvent[] = [];
  for (const e of roster) {
    if (e.checkIn) {
      events.push({
        key: `${e.employeeId}-in`,
        kind: 'in',
        time: e.checkIn.time,
        entry: e,
        note: e.checkIn.isLate ? `${minutesText(e.checkIn.lateMinutes)} kechikdi` : "O'z vaqtida",
        tone: e.checkIn.isLate ? 'warning' : 'success',
      });
    }
    if (e.checkOut) {
      const early = e.earlyLeaveMinutes ?? 0;
      events.push({
        key: `${e.employeeId}-out`,
        kind: 'out',
        time: e.checkOut.time,
        entry: e,
        note:
          early > 0
            ? `${minutesText(early)} erta ketdi`
            : e.hoursWorked != null
              ? hoursText(e.hoursWorked)
              : 'Ketdi',
        tone: early > 0 ? 'danger' : 'info',
      });
    }
    for (const [i, f] of (e.failedScans ?? []).entries()) {
      events.push({
        key: `${e.employeeId}-f${i}`,
        kind: 'failed',
        time: f.time,
        entry: e,
        note: humanizeScanReason(f.reason),
        tone: 'danger',
      });
    }
  }
  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}
