import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DayStat {
  date: string; // YYYY-MM-DD (local)
  checkIn: Date | null;
  checkOut: Date | null;
  hours: number; // worked hours that day (0 if unpaired)
  late: boolean;
  lateMinutes: number;
}

export interface EmployeePeriodStats {
  employeeId: string;
  fullName: string;
  position: string;
  from: string;
  to: string;
  totalHours: number;
  daysPresent: number;
  daysLate: number;
  totalLateMinutes: number;
  days: DayStat[];
}

/** Local YYYY-MM-DD bucket (process TZ) — matches attendance daily grouping. */
function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Per-employee attendance stats over an arbitrary date range (bu oy / o'tgan oy
 * / ixtiyoriy oraliq). Pairs each local day's first CHECK_IN with its last
 * CHECK_OUT and sums the worked hours, counts late days, etc. Read-only; its own
 * module so it doesn't touch the concurrently-edited oversight/attendance files.
 */
@Injectable()
export class EmployeeStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async periodStats(employeeId: string, fromIso: string, toIso: string): Promise<EmployeePeriodStats> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, fullName: true, position: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const from = new Date(fromIso);
    const to = new Date(toIso);
    const records = await this.prisma.attendanceRecord.findMany({
      // Rejected scans (face/geofence mismatch) are attempts, not attendance —
      // same rule as the davomat board (attendance.service buildDayEntry).
      where: { employeeId, isValid: true, recordedAt: { gte: from, lte: to } },
      select: { type: true, recordedAt: true, isLate: true, lateMinutes: true },
      orderBy: { recordedAt: 'asc' },
    });

    // Group by local day; first CHECK_IN (with its late flag) + last CHECK_OUT.
    const byDay = new Map<string, { in: Date | null; out: Date | null; late: boolean; lateMinutes: number }>();
    for (const r of records) {
      const key = localDay(r.recordedAt);
      const e = byDay.get(key) ?? { in: null, out: null, late: false, lateMinutes: 0 };
      if (r.type === AttendanceType.CHECK_IN) {
        if (!e.in) {
          e.in = r.recordedAt;
          e.late = r.isLate;
          e.lateMinutes = r.lateMinutes;
        }
      } else if (r.type === AttendanceType.CHECK_OUT) {
        e.out = r.recordedAt;
      }
      byDay.set(key, e);
    }

    const days: DayStat[] = [];
    let totalHours = 0;
    let daysLate = 0;
    let totalLateMinutes = 0;
    for (const [date, e] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const hours = e.in && e.out && e.out > e.in ? Math.round(((e.out.getTime() - e.in.getTime()) / 3_600_000) * 10) / 10 : 0;
      totalHours += hours;
      if (e.late) {
        daysLate += 1;
        totalLateMinutes += e.lateMinutes;
      }
      days.push({ date, checkIn: e.in, checkOut: e.out, hours, late: e.late, lateMinutes: e.lateMinutes });
    }

    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      position: employee.position,
      from: fromIso,
      to: toIso,
      totalHours: Math.round(totalHours * 10) / 10,
      daysPresent: days.filter((d) => d.checkIn).length,
      daysLate,
      totalLateMinutes,
      days,
    };
  }
}
