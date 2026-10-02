import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord, AttendanceType, LeaveRequest, LeaveStatus } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { bestMatchScore } from '../../common/utils/face-match.util';
import { ownUploadUrl } from '../../common/utils/upload-url.util';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import {
  DailyReportQueryDto,
  MonthlyReportQueryDto,
  RangeReportQueryDto,
  TodayQueryDto,
} from './dto/attendance-report-query.dto';
import { VerifyFaceDto } from './dto/verify-face.dto';
import { VerifyFaceResultDto } from './dto/verify-face-result.dto';
import { ZonesService, zoneToleranceM } from '../zones/zones.service';
import { distanceInMeters } from './utils/geo.util';
import { dayRange, formatLocalDate, minutesAfter, parseTimeOnDate } from './utils/date.util';

export interface EmployeeDailySummary {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
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
  avatarUrl: string | null;
}

export interface AttendanceReport {
  from: Date;
  to: Date;
  totalRecords: number;
  perEmployee: EmployeeDailySummary[];
  /** Active employees (respecting the employeeId filter) with no valid CHECK_IN in range. */
  absentees: ReportAbsentee[];
}

/**
 * present/late = in, still working · left = checked out · absent = a working
 * day with no check-in · leave = approved whole-day leave (ta'til) ·
 * dayoff = not a working day (WORK_DAYS) and nobody is expected.
 */
export type TodayAttendanceStatus = 'present' | 'late' | 'absent' | 'left' | 'leave' | 'dayoff';

/** Where a scan may be accepted for one employee. */
export interface Workplace {
  officeLat: number;
  officeLng: number;
  radiusM: number;
  /** Assigned mahalla codes — standing inside one counts as "at work" too. */
  zones: string[];
}

/** Result of checking a position against an employee's workplace. */
export interface PlaceCheck {
  place: 'office' | 'zone' | null;
  distanceM: number;
  mahallaName: string | null;
}

/** Approved leave as it applies to one day. */
export interface TodayLeave {
  type: 'days' | 'hours';
  reason: string;
  /** Hours-type: the permitted window (local HH:mm). */
  from?: string;
  to?: string;
}

/** `POST /attendance/precheck` — can I check in/out from here, and why not. */
export interface PrecheckResult extends PlaceCheck {
  allowed: boolean;
  radiusM: number;
  officeLat: number;
  officeLng: number;
  zonesCount: number;
  message: string;
}

export interface TodayCheckIn {
  time: Date;
  isLate: boolean;
  lateMinutes: number;
  insideGeofence: boolean;
  /** Face match score of the accepted scan (0..1). */
  faceScore: number;
  /** Metres from the office point when the scan was made. */
  distanceM: number;
  /** Face frame of the accepted scan (null for older scans / upload failed). */
  photoUrl: string | null;
}

export interface TodayCheckOut {
  time: Date;
  insideGeofence: boolean;
  faceScore: number;
  distanceM: number;
  photoUrl: string | null;
}

/** A scan the server rejected (face below threshold and/or outside the geofence). */
export interface TodayFailedScan {
  type: AttendanceType;
  time: Date;
  reason: string | null;
  faceScore: number;
  distanceM: number;
  /** Who actually stood in front of the camera on the rejected scan. */
  photoUrl: string | null;
}

/** The employee's latest live-location report (today's board only). */
export interface TodayLiveLocation {
  at: Date;
  mahallaName: string | null;
  insideZone: boolean;
  stale: boolean;
}

export interface EmployeeTodayEntry {
  employeeId: string;
  fullName: string;
  position: string;
  phone: string;
  avatarUrl: string | null;
  department: string | null;
  workStartTime: string;
  workEndTime: string;
  checkIn: TodayCheckIn | null;
  checkOut: TodayCheckOut | null;
  status: TodayAttendanceStatus;
  hoursWorked: number | null;
  /** Minutes the employee checked out before their workEndTime (0 = not early). */
  earlyLeaveMinutes: number;
  failedScans: TodayFailedScan[];
  live: TodayLiveLocation | null;
  /** Approved leave touching this day (whole day, or an excused window). */
  leave: TodayLeave | null;
  /** Lateness / early leave was covered by an approved hours-leave. */
  excused: boolean;
}

export interface TodayAttendanceSummary {
  total: number;
  /** Checked in and still working, on time. */
  present: number;
  /** Checked in late and still working (late employees who already left count as `left`). */
  late: number;
  absent: number;
  left: number;
  /** Everyone with a valid check-in today (present + late + left). */
  checkedIn: number;
  /** Checked in and not yet checked out. */
  workingNow: number;
  /** Every late arrival today, including those who already left. */
  lateTotal: number;
  onTime: number;
  earlyLeave: number;
  /** Employees with at least one rejected scan today. */
  withFailedScans: number;
  onLeave: number;
}

export interface TodayAttendance {
  date: Date;
  roster: EmployeeTodayEntry[];
  summary: TodayAttendanceSummary;
  workStartTime: string;
  workEndTime: string;
  /** false on a non-working day (WORK_DAYS) — nobody counts as absent. */
  isWorkday: boolean;
}

/** A single day's pairing result, shared by `today()` and `me()`. */
interface DayAttendanceEntry {
  status: TodayAttendanceStatus;
  checkIn: TodayCheckIn | null;
  checkOut: TodayCheckOut | null;
  hoursWorked: number | null;
}

/** Bitta katak: xodimning bir kuni (tabel). */
export interface TimesheetCell {
  date: string;
  /** present | late | left | absent | leave | dayoff | future */
  status: TodayAttendanceStatus | 'future';
  in: string | null;
  out: string | null;
  hours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  /** Kechikish/erta ketish soatlik ruxsat bilan qoplangan. */
  excused: boolean;
  /** Ta'til sababi (bo'lsa). */
  leave: string | null;
}

export interface TimesheetRow {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  avatarUrl: string | null;
  workStartTime: string;
  workEndTime: string;
  cells: TimesheetCell[];
  totals: {
    /** Ish kunlari (o'tgan, ta'tilsiz) — "kelishi kerak edi". */
    workdays: number;
    came: number;
    late: number;
    lateMinutes: number;
    earlyLeaves: number;
    earlyMinutes: number;
    absent: number;
    leave: number;
    hours: number;
    /** Norma: ish kunlari × kunlik ish soati. */
    normHours: number;
  };
}

export interface Timesheet {
  from: string;
  to: string;
  days: { date: string; weekday: number; isWorkday: boolean; isToday: boolean; isFuture: boolean }[];
  rows: TimesheetRow[];
  /** Har kun: nechta keldi / kelishi kerak edi. */
  daily: { date: string; came: number; expected: number }[];
}

export interface MeWeekCheckIn {
  time: Date;
  isLate: boolean;
  lateMinutes: number;
  photoUrl: string | null;
}

export interface MeDayEntry {
  date: string;
  status: TodayAttendanceStatus;
  checkIn: TodayCheckIn | null;
  checkOut: TodayCheckOut | null;
  hoursWorked: number | null;
}

export interface MeWeekEntry {
  date: string;
  status: TodayAttendanceStatus;
  checkIn: MeWeekCheckIn | null;
  checkOut: TodayCheckOut | null;
  hoursWorked: number | null;
}

export interface EmployeeMeAttendance {
  employeeId: string;
  fullName: string;
  department: string | null;
  workStartTime: string;
  workEndTime: string;
  /** false on a non-working day — the app shows "Dam olish kuni". */
  isWorkday: boolean;
  /** Where check-in counts: office point + radius, and how many mahallas are assigned. */
  workplace: { officeLat: number; officeLng: number; radiusM: number; zonesCount: number };
  today: MeDayEntry;
  week: MeWeekEntry[];
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly zones: ZonesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Workplace rules — ONE source of truth for "may this scan count?"
  // ---------------------------------------------------------------------------

  /** The employee's own office (falls back to the global one) + assigned mahallas. */
  workplaceOf(emp: {
    officeLat: number | null;
    officeLng: number | null;
    officeRadiusM: number | null;
    assignedMahallaCodes: string[];
  }): Workplace {
    const g = this.configService.get('attendance', { infer: true });
    return {
      officeLat: emp.officeLat ?? g.officeLatitude,
      officeLng: emp.officeLng ?? g.officeLongitude,
      radiusM: emp.officeRadiusM ?? g.geofenceRadiusM,
      zones: emp.assignedMahallaCodes ?? [],
    };
  }

  /**
   * Office radius first; otherwise inside one of the assigned mahallas
   * (with the same GPS tolerance live tracking uses). Field staff who work in
   * their mahalla can check in there; office staff only at the office.
   */
  async placeOf(
    wp: Workplace,
    lat: number,
    lng: number,
    accuracy?: number | null,
  ): Promise<PlaceCheck> {
    const distanceM = Math.round(distanceInMeters(lat, lng, wp.officeLat, wp.officeLng));
    if (distanceM <= wp.radiusM) return { place: 'office', distanceM, mahallaName: null };
    if (wp.zones.length === 0) return { place: null, distanceM, mahallaName: null };
    const located = await this.zones.locate(lat, lng);
    const code = located.mahalla?.code ?? null;
    const mahallaName = located.mahalla?.nameUzLat ?? null;
    if (code && wp.zones.includes(code)) return { place: 'zone', distanceM, mahallaName };
    const near = await this.zones.isWithinToleranceOfMahallas(
      lat,
      lng,
      wp.zones,
      zoneToleranceM(accuracy),
    );
    return { place: near ? 'zone' : null, distanceM, mahallaName };
  }

  /**
   * Before the face scan: would a check-in/out from here be accepted? The
   * app shows the answer (and the distance) instead of guessing with
   * hard-coded coordinates.
   */
  async precheck(
    employeeId: string,
    pos: { latitude: number; longitude: number; accuracy?: number },
  ): Promise<PrecheckResult> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }
    const wp = this.workplaceOf(employee);
    const check = await this.placeOf(wp, pos.latitude, pos.longitude, pos.accuracy);
    const far = check.distanceM >= 1000
      ? `${(check.distanceM / 1000).toFixed(1)} km`
      : `${check.distanceM} m`;
    const message =
      check.place === 'office'
        ? 'Ish joyidasiz — belgilash mumkin'
        : check.place === 'zone'
          ? `Biriktirilgan mahallangizdasiz${check.mahallaName ? ` (${check.mahallaName})` : ''}`
          : wp.zones.length > 0
            ? `Ofisdan ${far} uzoqdasiz va biriktirilgan mahallangizda emassiz`
            : `Ish joyingizdan ${far} uzoqdasiz (ruxsat etilgan radius ${wp.radiusM} m)`;
    return {
      ...check,
      allowed: check.place !== null,
      radiusM: wp.radiusM,
      officeLat: wp.officeLat,
      officeLng: wp.officeLng,
      zonesCount: wp.zones.length,
      message,
    };
  }

  // ---------------------------------------------------------------------------
  // Calendar rules — working days and approved leave
  // ---------------------------------------------------------------------------

  isWorkday(day: Date): boolean {
    return this.configService.get('work', { infer: true }).workDays.includes(day.getDay());
  }

  /** Approved leave that may touch [from, to] (days-leave may start up to ~2 months earlier). */
  private approvedLeaves(from: Date, to: Date, employeeId?: string): Promise<LeaveRequest[]> {
    const earliest = new Date(from.getTime() - 62 * 86_400_000);
    return this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.approved,
        startDate: { gte: earliest, lte: to },
        ...(employeeId ? { employeeId } : {}),
      },
    });
  }

  /**
   * What approved leave means for one employee on one local day: a whole day
   * off (days-type covering it), and/or an excused window (hours-type on it).
   */
  private leaveOn(
    leaves: LeaveRequest[],
    employeeId: string,
    day: Date,
    workStart: string,
  ): { wholeDay: LeaveRequest | null; window: { start: Date; end: Date; leave: LeaveRequest } | null } {
    const key = formatLocalDate(day);
    let wholeDay: LeaveRequest | null = null;
    let window: { start: Date; end: Date; leave: LeaveRequest } | null = null;
    for (const l of leaves) {
      if (l.employeeId !== employeeId) continue;
      if (l.type === 'days') {
        const first = dayRange(l.startDate).from;
        const last = new Date(first);
        last.setDate(last.getDate() + Math.max(1, l.amount) - 1);
        const k1 = formatLocalDate(first);
        const k2 = formatLocalDate(last);
        if (key >= k1 && key <= k2) wholeDay = l;
      } else if (formatLocalDate(l.startDate) === key) {
        const start = parseTimeOnDate(day, l.startTime ?? workStart);
        window = { start, end: new Date(start.getTime() + Math.max(1, l.amount) * 3_600_000), leave: l };
      }
    }
    return { wholeDay, window };
  }

  /**
   * Applies working days and leave to a raw day entry: no check-in on a
   * leave day is "leave", on a non-working day "dayoff"; lateness inside a
   * permitted window is excused.
   */
  private applyCalendar(
    entry: DayAttendanceEntry,
    ctx: {
      isWorkday: boolean;
      leave: ReturnType<AttendanceService['leaveOn']>;
    },
  ): DayAttendanceEntry & { leave: TodayLeave | null; excused: boolean } {
    let { status, checkIn } = entry;
    let excused = false;
    const win = ctx.leave.window;
    if (checkIn?.isLate && win && checkIn.time.getTime() <= win.end.getTime()) {
      checkIn = { ...checkIn, isLate: false, lateMinutes: 0 };
      excused = true;
      if (status === 'late') status = 'present';
    }
    if (!entry.checkIn) {
      status = ctx.leave.wholeDay ? 'leave' : ctx.isWorkday ? 'absent' : 'dayoff';
    }
    const l = ctx.leave.wholeDay ?? win?.leave ?? null;
    const hhmm = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const leave: TodayLeave | null = l
      ? {
          type: l.type === 'days' ? 'days' : 'hours',
          reason: l.reason,
          ...(win && l === win.leave ? { from: hhmm(win.start), to: hhmm(win.end) } : {}),
        }
      : null;
    return { ...entry, status, checkIn, leave, excused };
  }

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
   * Attendance report over an arbitrary date range (inclusive of both ends),
   * powering the web-admin davomat "oraliq" (interval) view — Bu hafta / O'tgan
   * oy / Bu yil / custom range. Reuses the same aggregator as daily/monthly.
   */
  async rangeReport(query: RangeReportQueryDto): Promise<AttendanceReport> {
    const now = new Date();
    const fromDay = query.from ? new Date(query.from) : now;
    const toDay = query.to ? new Date(query.to) : now;
    const from = dayRange(fromDay).from;
    const to = dayRange(toDay).to;
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
    const leaves = await this.approvedLeaves(from, to);
    const isWorkday = this.isWorkday(from);

    const recordsByEmployee = new Map<string, AttendanceRecord[]>();
    for (const record of records) {
      const list = recordsByEmployee.get(record.employeeId);
      if (list) {
        list.push(record);
      } else {
        recordsByEmployee.set(record.employeeId, [record]);
      }
    }

    // Live location only makes sense for the board of the current day.
    const isToday = formatLocalDate(from) === formatLocalDate(new Date());
    const { staleMinutes } = this.configService.get('location', { infer: true });
    const staleBefore = Date.now() - staleMinutes * 60_000;

    const roster: EmployeeTodayEntry[] = employees.map((employee) => {
      const empRecords = recordsByEmployee.get(employee.id) ?? [];
      const wp = this.workplaceOf(employee);
      const leaveDay = this.leaveOn(leaves, employee.id, from, employee.workStartTime);
      const { status, checkIn, checkOut, hoursWorked, leave, excused: lateExcused } =
        this.applyCalendar(this.buildDayEntry(empRecords, wp), { isWorkday, leave: leaveDay });

      const rawEarly = checkOut
        ? Math.max(
            0,
            minutesAfter(checkOut.time, parseTimeOnDate(checkOut.time, employee.workEndTime)),
          )
        : 0;
      // Leaving inside a permitted hours-window is not "early".
      const earlyExcused =
        rawEarly > 0 &&
        !!leaveDay.window &&
        checkOut!.time.getTime() >= leaveDay.window.start.getTime();
      const earlyLeaveMinutes = earlyExcused ? 0 : rawEarly;

      const failedScans: TodayFailedScan[] = empRecords
        .filter((record) => !record.isValid)
        .map((record) => ({
          type: record.type,
          time: record.recordedAt,
          reason: record.reason,
          faceScore: record.faceScore,
          distanceM: Math.round(
            distanceInMeters(record.latitude, record.longitude, wp.officeLat, wp.officeLng),
          ),
          photoUrl: record.photoUrl ?? null,
        }));

      const live: TodayLiveLocation | null =
        isToday && employee.lastLocationAt
          ? {
              at: employee.lastLocationAt,
              mahallaName: employee.lastMahallaName ?? null,
              insideZone: employee.lastInsideAssignedZone,
              stale: employee.lastLocationAt.getTime() < staleBefore,
            }
          : null;

      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        phone: employee.phone,
        avatarUrl: employee.avatarUrl ?? null,
        department: employee.department?.name ?? null,
        workStartTime: employee.workStartTime,
        workEndTime: employee.workEndTime,
        checkIn,
        checkOut,
        status,
        hoursWorked,
        earlyLeaveMinutes,
        failedScans,
        live,
        leave,
        excused: lateExcused || earlyExcused,
      };
    });

    const count = (pred: (entry: EmployeeTodayEntry) => boolean) => roster.filter(pred).length;
    const summary: TodayAttendanceSummary = {
      total: roster.length,
      present: count((entry) => entry.status === 'present'),
      late: count((entry) => entry.status === 'late'),
      absent: count((entry) => entry.status === 'absent'),
      left: count((entry) => entry.status === 'left'),
      checkedIn: count((entry) => entry.checkIn !== null),
      workingNow: count((entry) => entry.checkIn !== null && entry.checkOut === null),
      lateTotal: count((entry) => entry.checkIn?.isLate === true),
      onTime: count((entry) => entry.checkIn !== null && !entry.checkIn.isLate),
      earlyLeave: count((entry) => entry.earlyLeaveMinutes > 0),
      withFailedScans: count((entry) => entry.failedScans.length > 0),
      onLeave: count((entry) => entry.status === 'leave'),
    };

    const work = this.configService.get('work', { infer: true });
    return {
      date: from,
      roster,
      summary,
      workStartTime: work.startTime,
      workEndTime: work.endTime,
      isWorkday,
    };
  }

  /**
   * The authenticated employee's own attendance: today's status plus the
   * last 7 calendar days (oldest -> newest, today last). Uses the same
   * per-day CHECK_IN/CHECK_OUT pairing as `today()`, just scoped to one
   * employee across a date range instead of one day across all employees.
   */
  async me(employeeId: string): Promise<EmployeeMeAttendance> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const { from } = dayRange(weekStart);
    const { to } = dayRange(today);

    const [records, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: 'asc' },
      }),
      this.approvedLeaves(from, to, employeeId),
    ]);
    const wp = this.workplaceOf(employee);
    const dayEntry = (day: Date, dayRecords: AttendanceRecord[]) =>
      this.applyCalendar(this.buildDayEntry(dayRecords, wp), {
        isWorkday: this.isWorkday(day),
        leave: this.leaveOn(leaves, employeeId, day, employee.workStartTime),
      });

    const recordsByDay = new Map<string, AttendanceRecord[]>();
    for (const record of records) {
      const key = formatLocalDate(record.recordedAt);
      const list = recordsByDay.get(key);
      if (list) {
        list.push(record);
      } else {
        recordsByDay.set(key, [record]);
      }
    }

    const week: MeWeekEntry[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setDate(day.getDate() - offset);
      const key = formatLocalDate(day);
      const dayRecords = recordsByDay.get(key) ?? [];

      const { status, checkIn, checkOut, hoursWorked } = dayEntry(day, dayRecords);

      week.push({
        date: key,
        status,
        checkIn: checkIn
          ? {
              time: checkIn.time,
              isLate: checkIn.isLate,
              lateMinutes: checkIn.lateMinutes,
              photoUrl: checkIn.photoUrl,
            }
          : null,
        checkOut,
        hoursWorked,
      });
    }

    const todayKey = formatLocalDate(today);
    const todayDayEntry = dayEntry(today, recordsByDay.get(todayKey) ?? []);

    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      department: employee.department?.name ?? null,
      workStartTime: employee.workStartTime,
      workEndTime: employee.workEndTime,
      isWorkday: this.isWorkday(today),
      workplace: {
        officeLat: wp.officeLat,
        officeLng: wp.officeLng,
        radiusM: wp.radiusM,
        zonesCount: wp.zones.length,
      },
      today: { date: todayKey, ...todayDayEntry },
      week,
    };
  }

  /**
   * Tabel: barcha faol xodimlar × davrning har bir kuni (oy yoki ixtiyoriy
   * oraliq, ≤ 62 kun) — holat, keldi/ketdi, soat, kechikish, erta ketish va
   * jami/norma. Kunlik taxta bilan aynan bir xil qoidalar (ta'til, dam olish,
   * soatlik ruxsat); kelajak kunlar "future" (kelmadi hisoblanmaydi).
   */
  async timesheet(fromIso?: string, toIso?: string): Promise<Timesheet> {
    const now = new Date();
    const start = fromIso ? new Date(`${fromIso.slice(0, 10)}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    let end = toIso
      ? new Date(`${toIso.slice(0, 10)}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new BadRequestException("Davr noto'g'ri: boshlanish tugashdan oldin bo'lsin");
    }
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 61);
    if (end > maxEnd) end = maxEnd;

    const { from } = dayRange(start);
    const { to } = dayRange(end);
    const [employees, records, leaves] = await Promise.all([
      this.prisma.employee.findMany({
        where: { isActive: true },
        include: { department: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: 'asc' },
      }),
      this.approvedLeaves(from, to),
    ]);

    const byEmpDay = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const k = `${r.employeeId}|${formatLocalDate(r.recordedAt)}`;
      const list = byEmpDay.get(k);
      if (list) list.push(r);
      else byEmpDay.set(k, [r]);
    }

    const todayKey = formatLocalDate(now);
    const dayDates: Date[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dayDates.push(new Date(d));
    const days = dayDates.map((d) => {
      const key = formatLocalDate(d);
      return {
        date: key,
        weekday: (d.getDay() + 6) % 7,
        isWorkday: this.isWorkday(d),
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    });

    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const rows: TimesheetRow[] = employees.map((emp) => {
      const wp = this.workplaceOf(emp);
      const dailyHours =
        Math.max(0, minutesAfter(parseTimeOnDate(now, emp.workStartTime), parseTimeOnDate(now, emp.workEndTime))) / 60;
      const totals = {
        workdays: 0,
        came: 0,
        late: 0,
        lateMinutes: 0,
        earlyLeaves: 0,
        earlyMinutes: 0,
        absent: 0,
        leave: 0,
        hours: 0,
        normHours: 0,
      };
      const cells: TimesheetCell[] = dayDates.map((d, i) => {
        const info = days[i];
        if (info.isFuture) {
          return { date: info.date, status: 'future', in: null, out: null, hours: null, lateMinutes: 0, earlyMinutes: 0, excused: false, leave: null };
        }
        const leaveDay = this.leaveOn(leaves, emp.id, d, emp.workStartTime);
        const e = this.applyCalendar(this.buildDayEntry(byEmpDay.get(`${emp.id}|${info.date}`) ?? [], wp), {
          isWorkday: info.isWorkday,
          leave: leaveDay,
        });
        let early = 0;
        if (e.checkOut && info.isWorkday) {
          early = Math.max(0, minutesAfter(e.checkOut.time, parseTimeOnDate(d, emp.workEndTime)));
          if (leaveDay.window && e.checkOut.time.getTime() >= leaveDay.window.start.getTime()) early = 0;
        }
        const lateMinutes = e.checkIn?.isLate ? e.checkIn.lateMinutes : 0;
        if (e.status === 'leave') totals.leave += 1;
        else if (info.isWorkday) {
          totals.workdays += 1;
          totals.normHours += dailyHours;
          if (!e.checkIn) totals.absent += 1;
        }
        if (e.checkIn) totals.came += 1;
        if (lateMinutes > 0) {
          totals.late += 1;
          totals.lateMinutes += lateMinutes;
        }
        if (early > 0) {
          totals.earlyLeaves += 1;
          totals.earlyMinutes += early;
        }
        totals.hours += e.hoursWorked ?? 0;
        return {
          date: info.date,
          status: e.status,
          in: e.checkIn ? hhmm(e.checkIn.time) : null,
          out: e.checkOut ? hhmm(e.checkOut.time) : null,
          hours: e.hoursWorked,
          lateMinutes,
          earlyMinutes: early,
          excused: e.excused,
          leave: e.leave?.reason ?? null,
        };
      });
      totals.hours = Math.round(totals.hours * 10) / 10;
      totals.normHours = Math.round(totals.normHours * 10) / 10;
      return {
        employeeId: emp.id,
        fullName: emp.fullName,
        position: emp.position,
        department: emp.department?.name ?? null,
        avatarUrl: emp.avatarUrl,
        workStartTime: emp.workStartTime,
        workEndTime: emp.workEndTime,
        cells,
        totals,
      };
    });

    const daily = days.map((info, i) => {
      let came = 0;
      let expected = 0;
      for (const r of rows) {
        const c = r.cells[i];
        if (c.in) came += 1;
        if (info.isWorkday && !info.isFuture && c.status !== 'leave') expected += 1;
      }
      return { date: info.date, came, expected };
    });

    return { from: formatLocalDate(start), to: formatLocalDate(end), days, rows, daily };
  }

  /**
   * One employee's day-by-day attendance for the last [days] days, newest
   * first — the web-admin employee profile ("Davomat" tab). Same pairing and
   * calendar rules (leave, day off) as `me()`, scan photos included.
   */
  async history(employeeId: string, days = 30): Promise<MeWeekEntry[]> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }
    const span = Math.min(Math.max(days, 1), 92);
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (span - 1));
    const { from } = dayRange(start);
    const { to } = dayRange(today);
    const [records, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: 'asc' },
      }),
      this.approvedLeaves(from, to, employeeId),
    ]);
    const wp = this.workplaceOf(employee);
    const byDay = new Map<string, AttendanceRecord[]>();
    for (const record of records) {
      const key = formatLocalDate(record.recordedAt);
      byDay.set(key, [...(byDay.get(key) ?? []), record]);
    }
    const out: MeWeekEntry[] = [];
    for (let offset = 0; offset < span; offset += 1) {
      const day = new Date(today);
      day.setDate(day.getDate() - offset);
      const key = formatLocalDate(day);
      const { status, checkIn, checkOut, hoursWorked } = this.applyCalendar(
        this.buildDayEntry(byDay.get(key) ?? [], wp),
        {
          isWorkday: this.isWorkday(day),
          leave: this.leaveOn(leaves, employeeId, day, employee.workStartTime),
        },
      );
      out.push({
        date: key,
        status,
        checkIn: checkIn
          ? {
              time: checkIn.time,
              isLate: checkIn.isLate,
              lateMinutes: checkIn.lateMinutes,
              photoUrl: checkIn.photoUrl,
            }
          : null,
        checkOut,
        hoursWorked,
      });
    }
    return out;
  }

  /**
   * Pairs one employee's CHECK_IN/CHECK_OUT records for a single local day
   * into a status + hours-worked summary. `dayRecords` must already be
   * scoped to that one day, sorted ascending by `recordedAt` (shared by
   * `today()`'s per-employee roster and `me()`'s per-day week view).
   */
  private buildDayEntry(dayRecords: AttendanceRecord[], wp: Workplace): DayAttendanceEntry {
    const checkInRecord = dayRecords.find(
      (record) => record.type === AttendanceType.CHECK_IN && record.isValid,
    );
    const checkOutRecord = [...dayRecords]
      .reverse()
      .find((record) => record.type === AttendanceType.CHECK_OUT && record.isValid);

    const distanceOf = (record: AttendanceRecord) =>
      Math.round(distanceInMeters(record.latitude, record.longitude, wp.officeLat, wp.officeLng));
    // An accepted scan was at the office or in an assigned mahalla (`place`);
    // older rows without it fall back to the office radius.
    const atWork = (record: AttendanceRecord, distance: number) =>
      record.place != null || distance <= wp.radiusM;

    const checkInDistance = checkInRecord ? distanceOf(checkInRecord) : 0;
    const checkIn: TodayCheckIn | null = checkInRecord
      ? {
          time: checkInRecord.recordedAt,
          isLate: checkInRecord.isLate,
          lateMinutes: checkInRecord.lateMinutes,
          insideGeofence: atWork(checkInRecord, checkInDistance),
          faceScore: checkInRecord.faceScore,
          distanceM: checkInDistance,
          photoUrl: checkInRecord.photoUrl ?? null,
        }
      : null;

    const checkOutDistance = checkOutRecord ? distanceOf(checkOutRecord) : 0;
    const checkOut: TodayCheckOut | null = checkOutRecord
      ? {
          time: checkOutRecord.recordedAt,
          insideGeofence: atWork(checkOutRecord, checkOutDistance),
          faceScore: checkOutRecord.faceScore,
          distanceM: checkOutDistance,
          photoUrl: checkOutRecord.photoUrl ?? null,
        }
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
        ? Math.round(((checkOut.time.getTime() - checkIn.time.getTime()) / 3_600_000) * 100) /
          100
        : null;

    return { status, checkIn, checkOut, hoursWorked };
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
    // Only a VALID scan counts as "already checked in/out". A failed scan
    // (below face threshold or outside geofence, isValid=false) must NOT lock
    // the employee out for the day — they need to retry until one succeeds.
    const hasCheckIn = todaysRecords.some(
      (record) => record.type === AttendanceType.CHECK_IN && record.isValid,
    );
    const hasCheckOut = todaysRecords.some(
      (record) => record.type === AttendanceType.CHECK_OUT && record.isValid,
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

    const { faceMatchThreshold } = this.configService.get('attendance', { infer: true });
    const wp = this.workplaceOf(employee);
    const where = await this.placeOf(wp, dto.latitude, dto.longitude, dto.accuracy);
    const locationOk = where.place !== null;

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
        `${where.distanceM}m from office, outside ${wp.radiusM}m geofence` +
          (wp.zones.length > 0 ? ' and not in an assigned mahalla' : ''),
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
        place: where.place,
        photoUrl: ownUploadUrl(
          dto.photoUrl,
          this.configService.get('uploads', { infer: true })?.publicBaseUrl ?? '',
        ),
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
        select: { id: true, fullName: true, position: true, avatarUrl: true },
      }),
    ]);

    const empById = new Map(employees.map((e) => [e.id, e]));
    const byEmployee = new Map<string, EmployeeDailySummary>();
    const presentEmployeeIds = new Set<string>();

    for (const record of records) {
      let summary = byEmployee.get(record.employeeId);
      if (!summary) {
        const emp = empById.get(record.employeeId);
        summary = {
          employeeId: record.employeeId,
          fullName: emp?.fullName ?? '',
          position: emp?.position ?? '',
          avatarUrl: emp?.avatarUrl ?? null,
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

      if (record.type === AttendanceType.CHECK_IN && record.isValid) {
        // Only valid scans define arrival — a failed attempt must not be
        // reported as the employee's firstCheckIn.
        if (!summary.firstCheckIn) {
          summary.firstCheckIn = record.recordedAt;
        }
        presentEmployeeIds.add(record.employeeId);
        if (record.isLate) {
          summary.lateCount += 1;
          summary.lateMinutes += record.lateMinutes;
          summary.isLate = true;
        }
      }
      if (record.type === AttendanceType.CHECK_OUT && record.isValid) {
        summary.lastCheckOut = record.recordedAt;
      }
    }

    const absentees: ReportAbsentee[] = employees
      .filter((employee) => !presentEmployeeIds.has(employee.id))
      .map((employee) => ({
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        avatarUrl: employee.avatarUrl ?? null,
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
