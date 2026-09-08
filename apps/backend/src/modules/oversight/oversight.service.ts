import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AttendanceService, TodayAttendanceStatus } from '../attendance/attendance.service';
import { LocationsService } from '../locations/locations.service';
import { SalariesService } from '../salaries/salaries.service';

/** One employee's live oversight snapshot: face + attendance + territory + salary. */
export interface OversightRow {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  /** Has the employee enrolled a face template (worker-app biometric check-in)? */
  hasFace: boolean;
  attendance: {
    status: TodayAttendanceStatus;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    isLate: boolean;
    hoursWorked: number | null;
  };
  location: {
    hasLocation: boolean;
    insideAssignedZone: boolean;
    mahallaName: string | null;
    isStale: boolean;
  };
  /** Mahalla codes this employee is assigned to (empty = whole district). */
  assignedMahallaCodes: string[];
  /** Net salary for the requested month (null when unset). */
  salaryNet: number | null;
}

export interface OversightSummary {
  total: number;
  faceEnrolled: number;
  presentNow: number;
  lateNow: number;
  outsideZone: number;
  salaryTotalNet: number;
}

/**
 * Hokimiyat nazorati — a single read-only aggregation over existing services
 * (attendance, locations, salaries) plus face-enrollment, so the web-admin can
 * show every employee's face / keldi-ketdi / hudud / oylik in one table without
 * four separate round-trips. Aggregates in memory from three bulk queries.
 */
@Injectable()
export class OversightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly locations: LocationsService,
    private readonly salaries: SalariesService,
  ) {}

  async overview(
    year?: number,
    month?: number,
  ): Promise<{ year: number; month: number; rows: OversightRow[]; summary: OversightSummary }> {
    const [today, locs, roster, facedEmployees] = await Promise.all([
      this.attendance.today({}),
      this.locations.getLatestForAll(),
      this.salaries.monthlyRoster(year, month),
      this.prisma.faceTemplate.findMany({ distinct: ['employeeId'], select: { employeeId: true } }),
    ]);

    const faceSet = new Set(facedEmployees.map((f) => f.employeeId));
    const attMap = new Map(today.roster.map((a) => [a.employeeId, a]));
    const locMap = new Map(locs.map((l) => [l.employeeId, l]));

    // The salary roster already enumerates every ACTIVE employee (salary may be
    // null), so it's the canonical base list.
    const rows: OversightRow[] = roster.rows.map((base) => {
      const att = attMap.get(base.employeeId);
      const loc = locMap.get(base.employeeId);
      return {
        employeeId: base.employeeId,
        fullName: base.fullName,
        position: base.position,
        avatarUrl: base.avatarUrl,
        hasFace: faceSet.has(base.employeeId),
        attendance: {
          status: att?.status ?? 'absent',
          checkInAt: att?.checkIn?.time ?? null,
          checkOutAt: att?.checkOut?.time ?? null,
          isLate: att?.checkIn?.isLate ?? false,
          hoursWorked: att?.hoursWorked ?? null,
        },
        location: {
          hasLocation: loc?.hasLocation ?? false,
          insideAssignedZone: loc?.insideAssignedZone ?? true,
          mahallaName: loc?.mahallaName ?? null,
          isStale: loc?.isStale ?? true,
        },
        assignedMahallaCodes: loc?.assignedMahallaCodes ?? [],
        salaryNet: base.salary?.net ?? null,
      };
    });

    const summary: OversightSummary = {
      total: rows.length,
      faceEnrolled: rows.filter((r) => r.hasFace).length,
      presentNow: rows.filter((r) => r.attendance.status === 'present').length,
      lateNow: rows.filter((r) => r.attendance.status === 'late').length,
      outsideZone: rows.filter((r) => r.location.hasLocation && !r.location.insideAssignedZone).length,
      salaryTotalNet: roster.totalNet,
    };

    return { year: roster.year, month: roster.month, rows, summary };
  }
}
