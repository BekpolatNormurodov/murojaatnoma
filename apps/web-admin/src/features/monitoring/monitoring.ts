/* Kunlik monitoring: to'rt manbadan har xodim uchun bitta qator va alertlar. */
import { SILENT_AFTER_MIN, silentReason, type SilentInput } from '../map/silentReason.ts';

export interface MonitorPerson extends SilentInput {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
}

export interface Coverage {
  employeeId: string;
  /** Ish vaqtining hozirgacha o'tgan qismi, daqiqa. */
  windowMinutes: number;
  coveredMinutes: number;
}

export interface Attendance {
  employeeId: string;
  status: 'present' | 'late' | 'absent' | 'left' | 'leave' | 'dayoff';
  checkIn: { time: string; lateMinutes: number } | null;
}

export interface Row {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  /** Ta'tilda yoki dam olish kuni — talab qo'yilmaydi. */
  off: boolean;
  /** Joylashuv bo'yicha muammo matni; yo'q bo'lsa null. */
  problem: string | null;
  /** Hozir joylashuv kelyaptimi. */
  sending: boolean;
  /** Ish vaqtining qamralgan foizi; ish vaqti hali boshlanmagan bo'lsa null. */
  coverage: number | null;
  coveredMinutes: number;
  lastLocationAt: string | null;
  checkInAt: string | null;
  lateMinutes: number;
  absent: boolean;
  /** null — hisobot ma'lumoti hali yo'q. */
  reportSent: boolean | null;
}

export function buildRows(input: {
  people: MonitorPerson[];
  coverage?: Coverage[];
  attendance?: Attendance[];
  /** Bugungi hisobot soni xodim bo'yicha. */
  reports?: { employeeId: string; reportDays: number }[];
  now?: Date;
}): Row[] {
  const now = input.now ?? new Date();
  const coverage = new Map(input.coverage?.map((c) => [c.employeeId, c]));
  const attendance = new Map(input.attendance?.map((a) => [a.employeeId, a]));
  const reports = input.reports && new Map(input.reports.map((r) => [r.employeeId, r.reportDays]));
  return input.people
    .map((p) => {
      const c = coverage.get(p.employeeId);
      const a = attendance.get(p.employeeId);
      const off = a?.status === 'leave' || a?.status === 'dayoff';
      const sending =
        !!p.lastLocationAt && now.getTime() - new Date(p.lastLocationAt).getTime() <= SILENT_AFTER_MIN * 60_000;
      return {
        employeeId: p.employeeId,
        fullName: p.fullName,
        position: p.position,
        avatarUrl: p.avatarUrl,
        off,
        problem: silentReason(p, 'uz', now) ?? (sending ? null : 'Joylashuv kelmayapti'),
        sending,
        coverage: c && c.windowMinutes > 0 ? Math.min(100, Math.round((c.coveredMinutes / c.windowMinutes) * 100)) : null,
        coveredMinutes: c?.coveredMinutes ?? 0,
        lastLocationAt: p.lastLocationAt,
        checkInAt: a?.checkIn?.time ?? null,
        lateMinutes: a?.checkIn?.lateMinutes ?? 0,
        absent: a?.status === 'absent',
        reportSent: reports ? (reports.get(p.employeeId) ?? 0) > 0 : null,
      };
    })
    .sort(
      (x, y) =>
        Number(x.off) - Number(y.off) ||
        Number(x.sending) - Number(y.sending) ||
        (x.coverage ?? 101) - (y.coverage ?? 101) ||
        x.fullName.localeCompare(y.fullName),
    );
}

export type Filter = 'all' | 'silent' | 'settings' | 'absent' | 'noreport';

export function matches(row: Row, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (row.off) return false;
  if (filter === 'silent') return !row.sending;
  // Aloqada, lekin sozlamasi uzluksiz kuzatuvga xalaqit beradi.
  if (filter === 'settings') return row.sending && row.problem !== null;
  if (filter === 'absent') return row.absent;
  return row.reportSent === false;
}

export const hours = (minutes: number) =>
  minutes < 60 ? `${minutes} daq` : `${Math.floor(minutes / 60)} soat ${minutes % 60} daq`;
