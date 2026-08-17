import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord, AttendanceType } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { bestMatchScore } from '../../common/utils/face-match.util';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import {
  DailyReportQueryDto,
  MonthlyReportQueryDto,
  TodayQueryDto,
} from './dto/attendance-report-query.dto';
import { VerifyFaceDto } from './dto/verify-face.dto';
import { VerifyFaceResultDto } from './dto/verify-face-result.dto';
import { distanceInMeters } from './utils/geo.util';
import { dayRange, minutesAfter, parseTimeOnDate } from './utils/date.util';

export interface EmployeeDailySummary {
  employeeId: string;
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
  validScans: number;
  invalidScans: number;
  /** Number of valid CHECK_IN scans in the report range that were late. */
  lateCount: number;
  /** Sum of `lateMinutes` across those late CHECK_IN scans. */
  lateMinutes: number;
  /** True when the employee was late at least once in the report range. */
  isLate: boolean;
}

export interface ReportAbsentee {
  employeeId: string;
  fullName: string;
  position: string;
}

export interface AttendanceReport {
  from: Date;
  to: Date;
  totalRecords: number;
  perEmployee: EmployeeDailySummary[];
  /** Active employees (respecting the employeeId filter) with no valid CHECK_IN in range. */
  absentees: ReportAbsentee[];
}

export type TodayAttendanceStatus = 'present' | 'late' | 'absent' | 'left';

export interface TodayCheckIn {
  time: Date;
  isLate: boolean;
  lateMinutes: number;
  insideGeofence: boolean;
}

export interface TodayCheckOut {
  time: Date;
}

export interface EmployeeTodayEntry {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  checkIn: TodayCheckIn | null;
  checkOut: TodayCheckOut | null;
  status: TodayAttendanceStatus;
  hoursWorked: number | null;
}

export interface TodayAttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  left: number;
}

export interface TodayAttendance {
  date: Date;
  roster: EmployeeTodayEntry[];
  summary: TodayAttendanceSummary;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  checkIn(employeeId: string, dto: CheckInDto): Promise<AttendanceRecord> {
    return this.recordScan(AttendanceType.CHECK_IN, employeeId, dto);
  }

  checkOut(employeeId: string, dto: CheckOutDto): Promise<AttendanceRecord> {
    return this.recordScan(AttendanceType.CHECK_OUT, employeeId, dto);
  }

  /**
   * Matches a live face embedding against an employee's enrolled templates
   * without writing an attendance record. Used by the mobile app to give
   * the user immediate feedback before they actually check in/out.
   */
  async verifyFace(employeeId: string, dto: VerifyFaceDto): Promise<VerifyFaceResultDto> {
    const { faceMatchThreshold } = this.configService.get('attendance', { infer: true });

    const templates = await this.prisma.faceTemplate.findMany({
      where: { employeeId },
    });

    const score = bestMatchScore(
      dto.embedding,
      templates.map((template) => template.embedding),
    );

    return {
      matched: score >= faceMatchThreshold,
      score,
      threshold: faceMatchThreshold,
    };
  }

  async dailyReport(query: DailyReportQueryDto): Promise<AttendanceReport> {
    const day = query.date ? new Date(query.date) : new Date();
    const { from, to } = dayRange(day);

    return this.buildReport(from, to, query.employeeId);
  }

  async monthlyReport(query: MonthlyReportQueryDto): Promise<AttendanceReport> {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = (query.month ?? now.getMonth() + 1) - 1;

    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return this.buildReport(from, to, query.employeeId);
  }

  /**
   * Per-employee attendance roster for a single day (the web-admin "davomat"
   * board): every active employee paired with their CHECK_IN/CHECK_OUT scan
   * for that day, plus a derived status and hours worked.
   */
  async today(query: TodayQueryDto): Promise<TodayAttendance> {
    const day = query.date ? new Date(query.date) : new Date();
    const { from, to } = dayRange(day);

    const [employees, records] = await Promise.all([
      this.prisma.employee.findMany({
        where: { isActive: true },
        include: { department: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: 'asc' },
      }),
    ]);

    const { geofenceRadiusM, officeLatitude, officeLongitude } = this.configService.get(
      'attendance',
      { infer: true },
    );

    const recordsByEmployee = new Map<string, AttendanceRecord[]>();
    for (const record of records) {
      const list = recordsByEmployee.get(record.employeeId);
      if (list) {
        list.push(record);
      } else {
        recordsByEmployee.set(record.employeeId, [record]);
      }
    }

    const roster: EmployeeTodayEntry[] = employees.map((employee) => {
      const empRecords = recordsByEmployee.get(employee.id) ?? [];

      // Records are already sorted ascending by recordedAt.
      const checkInRecord = empRecords.find(
        (record) => record.type === AttendanceType.CHECK_IN && record.isValid,
      );
      const checkOutRecord = [...empRecords]
        .reverse()
        .find((record) => record.type === AttendanceType.CHECK_OUT && record.isValid);

      const checkIn: TodayCheckIn | null = checkInRecord
        ? {
            time: checkInRecord.recordedAt,
            isLate: checkInRecord.isLate,
            lateMinutes: checkInRecord.lateMinutes,
            insideGeofence:
              distanceInMeters(
                checkInRecord.latitude,
                checkInRecord.longitude,
                officeLatitude,
                officeLongitude,
              ) <= geofenceRadiusM,
          }
        : null;

      const checkOut: TodayCheckOut | null = checkOutRecord
        ? { time: checkOutRecord.recordedAt }
        : null;

      let status: TodayAttendanceStatus;
      if (!checkIn) {
        status = 'absent';
      } else if (checkOut) {
        status = 'left';
      } else if (checkIn.isLate) {
        status = 'late';
      } else {
        status = 'present';
      }

      const hoursWorked =
        checkIn && checkOut
          ? Math.round(
              ((checkOut.time.getTime() - checkIn.time.getTime()) / 3_600_000) * 100,
            ) / 100
          : null;

      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        department: employee.department?.name ?? null,
        checkIn,
        checkOut,
        status,
        hoursWorked,
      };
    });

    const summary: TodayAttendanceSummary = {
      total: roster.length,
      present: roster.filter((entry) => entry.status === 'present').length,
      late: roster.filter((entry) => entry.status === 'late').length,
      absent: roster.filter((entry) => entry.status === 'absent').length,
      left: roster.filter((entry) => entry.status === 'left').length,
    };

    return { date: from, roster, summary };
  }

  private async recordScan(
    type: AttendanceType,
    employeeId: string,
    dto: CheckInDto,
  ): Promise<AttendanceRecord> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const recordedAt = new Date();

    // --- Double-scan guard: at most one CHECK_IN and one CHECK_OUT per local day. ---
    const { from, to } = dayRange(recordedAt);
    const todaysRecords = await this.prisma.attendanceRecord.findMany({
      where: { employeeId, recordedAt: { gte: from, lte: to } },
    });
    const hasCheckIn = todaysRecords.some(
      (record) => record.type === AttendanceType.CHECK_IN,
    );
    const hasCheckOut = todaysRecords.some(
      (record) => record.type === AttendanceType.CHECK_OUT,
    );

    if (type === AttendanceType.CHECK_IN && hasCheckIn) {
      throw new ConflictException('Bugun allaqachon keldingiz belgilangan');
    }
    if (type === AttendanceType.CHECK_OUT) {
      if (!hasCheckIn) {
        throw new BadRequestException('Avval kelganingizni belgilashingiz kerak');
      }
      if (hasCheckOut) {
        throw new ConflictException('Bugun allaqachon ketganingiz belgilangan');
      }
    }

    const { faceMatchThreshold, geofenceRadiusM, officeLatitude, officeLongitude } =
      this.configService.get('attendance', { infer: true });

    const distance = distanceInMeters(
      dto.latitude,
      dto.longitude,
      officeLatitude,
      officeLongitude,
    );
    const locationOk = distance <= geofenceRadiusM;

    const reasons: string[] = [];
    let faceScore: number;
    let missingEnrollment = false;

    if (dto.embedding) {
      // Server-side match: authoritative whenever the client sends a live
      // embedding, regardless of any faceScore the client also included.
      const templates = await this.prisma.faceTemplate.findMany({
        where: { employeeId },
      });

      if (templates.length === 0) {
        missingEnrollment = true;
        faceScore = 0;
        reasons.push('no enrolled face template for this employee');
      } else {
        faceScore = bestMatchScore(
          dto.embedding,
          templates.map((template) => template.embedding),
        );
      }
    } else {
      // Backward-compatible path: trust the client-reported on-device score.
      faceScore = dto.faceScore ?? 0;
    }

    const faceOk = !missingEnrollment && faceScore >= faceMatchThreshold;
    const isValid = faceOk && locationOk;

    if (!faceOk && !missingEnrollment) {
      reasons.push(
        `face score ${faceScore.toFixed(2)} below threshold ${faceMatchThreshold}`,
      );
    }
    if (!locationOk) {
      reasons.push(
        `${distance.toFixed(0)}m from office, outside ${geofenceRadiusM}m geofence`,
      );
    }

    // --- Lateness (CHECK_IN only): workStartTime + grace period vs recordedAt. ---
    let isLate = false;
    let lateMinutes = 0;
    if (type === AttendanceType.CHECK_IN) {
      const { lateGraceMinutes } = this.configService.get('work', { infer: true });
      const workStart = parseTimeOnDate(recordedAt, employee.workStartTime);
      const deadline = new Date(workStart.getTime() + lateGraceMinutes * 60_000);
      lateMinutes = Math.max(0, minutesAfter(deadline, recordedAt));
      isLate = lateMinutes > 0;
    }

    return this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        type,
        faceScore,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isValid,
        reason: reasons.length > 0 ? reasons.join('; ') : null,
        isLate,
        lateMinutes,
        recordedAt,
      },
    });
  }

  private async buildReport(
    from: Date,
    to: Date,
    employeeId?: string,
  ): Promise<AttendanceReport> {
    const [records, employees] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: {
          recordedAt: { gte: from, lte: to },
          ...(employeeId ? { employeeId } : {}),
        },
        orderBy: { recordedAt: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: {
          isActive: true,
          ...(employeeId ? { id: employeeId } : {}),
        },
        select: { id: true, fullName: true, position: true },
      }),
    ]);

    const byEmployee = new Map<string, EmployeeDailySummary>();
    const presentEmployeeIds = new Set<string>();

    for (const record of records) {
      let summary = byEmployee.get(record.employeeId);
      if (!summary) {
        summary = {
          employeeId: record.employeeId,
          firstCheckIn: null,
          lastCheckOut: null,
          validScans: 0,
          invalidScans: 0,
          lateCount: 0,
          lateMinutes: 0,
          isLate: false,
        };
        byEmployee.set(record.employeeId, summary);
      }

      if (record.isValid) {
        summary.validScans += 1;
      } else {
        summary.invalidScans += 1;
      }

      if (record.type === AttendanceType.CHECK_IN) {
        if (!summary.firstCheckIn) {
          summary.firstCheckIn = record.recordedAt;
        }
        if (record.isValid) {
          presentEmployeeIds.add(record.employeeId);
          if (record.isLate) {
            summary.lateCount += 1;
            summary.lateMinutes += record.lateMinutes;
            summary.isLate = true;
          }
        }
      }
      if (record.type === AttendanceType.CHECK_OUT) {
        summary.lastCheckOut = record.recordedAt;
      }
    }

    const absentees: ReportAbsentee[] = employees
      .filter((employee) => !presentEmployeeIds.has(employee.id))
      .map((employee) => ({
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
      }));

    return {
      from,
      to,
      totalRecords: records.length,
      perEmployee: Array.from(byEmployee.values()),
      absentees,
    };
  }
}
