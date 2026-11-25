import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceType, Prisma } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ownUploadUrl } from '../../common/utils/upload-url.util';
import {
  CreateDailyReportDto,
  REPORT_BACKDATE_DAYS,
  ReportAttachmentDto,
  ReportAttachmentKind,
} from './dto';
import {
  emptyZoneDay,
  toMinutes,
  WorkSchedule,
  ZONE_GAP_MS,
  ZONE_MAX_ACCURACY_M,
  ZoneDay,
  zoneDays,
  ZoneStretch,
} from './zone-time';

export interface ReportAttachment {
  kind: ReportAttachmentKind;
  url: string;
  fileName: string | null;
  fileSize: number | null;
  durationSec: number | null;
}

export interface DailyReportView {
  id: string;
  employeeId: string;
  day: string;
  text: string | null;
  attachments: ReportAttachment[];
  createdAt: Date;
  /** Present on admin lists. */
  employee?: { fullName: string; position: string; avatarUrl: string | null };
}

/** One employee over a period — the row behind the "Faollik" Excel sheet. */
export interface ActivityRow {
  employeeId: string;
  fullName: string;
  position: string;
  department: string | null;
  avatarUrl: string | null;
  /** Biriktirilgan mahallalar nomi (bo'sh = biriktirilmagan). */
  mahallas: string[];
  /** Ish jadvali, "09:00" / "18:00". */
  workStartTime: string;
  workEndTime: string;
  /** Hisobot bergan kunlar soni (har xil kunlar). */
  reportDays: number;
  /** Jami hisobotlar soni. */
  reportCount: number;
  /** Biriktirilgan hududda bo'lgan vaqt, daqiqa. */
  zoneMinutes: number;
  /** Lokatsiya kelib turgan (faol) vaqt, daqiqa. */
  activeMinutes: number;
  /** Davomat bo'yicha ish vaqti (keldi → ketdi), daqiqa. */
  workMinutes: number;
  /** Kelgan kunlar soni. */
  daysWorked: number;
  /** Ofisda (hududdan tashqarida) bo'lgan vaqt, daqiqa. */
  officeMinutes: number;
  /** Ish soatlari ichida hududda bo'lgan vaqt, daqiqa. */
  workZoneMinutes: number;
  /** Ish soatlari ichida faol bo'lgan vaqt, daqiqa. */
  workActiveMinutes: number;
  /** Keldi bor, ketdi yo'q kunlar soni (bugun hisobga olinmaydi). */
  missingCheckOutDays: number;
  /** Ishdan bo'shatilgan (arxivdagi) xodim. */
  archived: boolean;
}

/** One employee's one day — the row behind the day-by-day Excel sheet. */
export interface ActivityDay {
  date: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  workMinutes: number;
  reportCount: number;
  zoneMinutes: number;
  officeMinutes: number;
  outsideMinutes: number;
  unassignedMinutes: number;
  activeMinutes: number;
  workZoneMinutes: number;
  workActiveMinutes: number;
  firstAt: Date | null;
  lastAt: Date | null;
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
  /** Oldest first, every day of the period present. */
  days: ActivityDay[];
}

export interface ZoneTimeView {
  gapMinutes: number;
  workStartTime: string;
  workEndTime: string;
  /** Newest first, every day present. */
  days: ZoneDay[];
}

/** First valid keldi and last valid ketdi of one local day. */
interface DayAttendance {
  in: Date | null;
  out: Date | null;
}

/** Zone/active minutes of one employee over a period. */
interface ZoneTotals {
  zone: number;
  office: number;
  active: number;
  workZone: number;
  workActive: number;
}

/** One employee-day of the SQL pass; all figures in seconds. */
interface ZoneSecondsRow {
  employeeId: string;
  day: string;
  zone_s: number;
  office_s: number;
  outside_s: number;
  none_s: number;
  work_zone_s: number;
  work_office_s: number;
  work_outside_s: number;
  work_none_s: number;
}

/** Longest period one activity/list request may span. */
const MAX_RANGE_DAYS = 92;
/** The day-by-day sheet reads every fix, so it spans less (dates inclusive). */
const MAX_DAILY_DAYS = 31;
/** Without `from`, a period starts this many days before `to` (8 days inclusive). */
const DEFAULT_LOOKBACK_DAYS = 7;
/** Rows read per day of one employee's window (a fix / 30 s is ~2 900 a day). */
const ZONE_FIXES_PER_DAY = 6_000;
export const REPORT_LIST_DEFAULT_LIMIT = 1000;
const DAY_MS = 86_400_000;

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" → that local day at 00:00, or null when it is not a real date. */
function parseDay(day: string): Date | null {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** The fix window of the days `from`..`to`: one gap wider on each side. */
function withGapMargin(from: Date, to: Date): { gte: Date; lte: Date } {
  return {
    gte: new Date(from.getTime() - ZONE_GAP_MS),
    lte: new Date(to.getTime() + ZONE_GAP_MS),
  };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ---------------------------------------------------------------------------
  // Period helpers
  // ---------------------------------------------------------------------------

  /**
   * Validated inclusive local-day range; defaults to `to` and the 7 days before
   * it. `maxSpan` = most days `to` may be after `from`; `shownMax` is the number
   * named in the refusal.
   */
  private range(
    from?: string,
    to?: string,
    maxSpan: number = MAX_RANGE_DAYS,
    shownMax: number = maxSpan,
  ): { from: Date; to: Date; fromDay: string; toDay: string } {
    const today = startOfToday();
    const toDate = to ? parseDay(to) : today;
    const fromDate = from
      ? parseDay(from)
      : new Date((toDate ?? today).getTime() - DEFAULT_LOOKBACK_DAYS * DAY_MS);
    if (!toDate || !fromDate) throw new BadRequestException("Sana noto'g'ri");
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException("Boshlanish sanasi tugash sanasidan keyin bo'lmasin");
    }
    if ((toDate.getTime() - fromDate.getTime()) / DAY_MS > maxSpan) {
      throw new BadRequestException(`Davr ${shownMax} kundan oshmasin`);
    }
    return { from: fromDate, to: endOfDay(toDate), fromDay: localDate(fromDate), toDay: localDate(toDate) };
  }

  // ---------------------------------------------------------------------------
  // Daily reports
  // ---------------------------------------------------------------------------

  private cleanAttachments(input: ReportAttachmentDto[] | undefined): ReportAttachment[] {
    const base = this.config.get('uploads', { infer: true })?.publicBaseUrl ?? '';
    const out: ReportAttachment[] = [];
    for (const a of input ?? []) {
      const url = ownUploadUrl(a.url, base);
      if (!url) {
        throw new BadRequestException("Fayl manzili noto'g'ri — avval faylni yuklang");
      }
      out.push({
        kind: a.kind,
        url,
        fileName: a.fileName?.trim() || null,
        fileSize: a.fileSize ?? null,
        durationSec: a.durationSec ?? null,
      });
    }
    return out;
  }

  private view(
    r: {
      id: string;
      employeeId: string;
      day: string;
      text: string | null;
      attachments: Prisma.JsonValue;
      createdAt: Date;
      employee?: { fullName: string; position: string; avatarUrl: string | null };
    },
  ): DailyReportView {
    return {
      id: r.id,
      employeeId: r.employeeId,
      day: r.day,
      text: r.text,
      attachments: Array.isArray(r.attachments) ? (r.attachments as unknown as ReportAttachment[]) : [],
      createdAt: r.createdAt,
      ...(r.employee ? { employee: r.employee } : {}),
    };
  }

  async create(employeeId: string, dto: CreateDailyReportDto): Promise<DailyReportView> {
    const text = dto.text?.trim() || null;
    const attachments = this.cleanAttachments(dto.attachments);
    if (!text && attachments.length === 0) {
      throw new BadRequestException("Hisobot bo'sh — matn yozing yoki fayl biriktiring");
    }

    const today = startOfToday();
    let day = localDate(today);
    if (dto.day) {
      const d = parseDay(dto.day);
      if (!d) throw new BadRequestException("Sana noto'g'ri");
      if (d.getTime() > today.getTime()) {
        throw new BadRequestException("Kelajak kun uchun hisobot yuborib bo'lmaydi");
      }
      if ((today.getTime() - d.getTime()) / DAY_MS > REPORT_BACKDATE_DAYS) {
        throw new BadRequestException(`Hisobot ko'pi bilan ${REPORT_BACKDATE_DAYS} kun orqaga yuboriladi`);
      }
      day = dto.day;
    }

    const row = await this.prisma.dailyReport.create({
      data: { employeeId, day, text, attachments: attachments as unknown as Prisma.InputJsonValue },
    });
    return this.view(row);
  }

  /** The employee's own reports, newest first. */
  async mine(employeeId: string, days = 30): Promise<DailyReportView[]> {
    const since = localDate(new Date(startOfToday().getTime() - (days - 1) * DAY_MS));
    const rows = await this.prisma.dailyReport.findMany({
      where: { employeeId, day: { gte: since } },
      orderBy: [{ day: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.view(r));
  }

  /** An employee may take back a report only on the day they sent it. */
  async removeMine(employeeId: string, id: string): Promise<void> {
    const row = await this.prisma.dailyReport.findUnique({ where: { id } });
    if (!row || row.employeeId !== employeeId) throw new NotFoundException('Hisobot topilmadi');
    if (localDate(row.createdAt) !== localDate(new Date())) {
      throw new ForbiddenException("Hisobotni faqat yuborilgan kuni o'chirish mumkin");
    }
    await this.prisma.dailyReport.delete({ where: { id } });
  }

  /** Admin: reports in a period (optionally one employee), newest first, one page. */
  async list(q: {
    from?: string;
    to?: string;
    employeeId?: string;
    limit?: number;
    offset?: number;
  }): Promise<DailyReportView[]> {
    const { fromDay, toDay } = this.range(q.from, q.to);
    const rows = await this.prisma.dailyReport.findMany({
      where: {
        day: { gte: fromDay, lte: toDay },
        ...(q.employeeId ? { employeeId: q.employeeId } : {}),
      },
      // `id` last: pages must not overlap when two rows share a timestamp.
      orderBy: [{ day: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit ?? REPORT_LIST_DEFAULT_LIMIT,
      skip: q.offset ?? 0,
      include: { employee: { select: { fullName: true, position: true, avatarUrl: true } } },
    });
    return rows.map((r) => this.view(r));
  }

  // ---------------------------------------------------------------------------
  // Hududda yurgan vaqt
  // ---------------------------------------------------------------------------

  /** Do working hours count on `date`? A working weekday, or a day with a valid check-in. */
  private countsAsWorkday(
    date: string,
    attendance: Map<string, DayAttendance> | undefined,
  ): boolean {
    if (attendance?.get(date)?.in) return true;
    const day = parseDay(date);
    return (
      !!day && this.config.get('work', { infer: true }).workDays.includes(day.getDay())
    );
  }

  private scheduleOf(
    employee: { workStartTime: string; workEndTime: string },
    attendance: Map<string, DayAttendance> | undefined,
  ): WorkSchedule {
    return {
      startTime: employee.workStartTime,
      endTime: employee.workEndTime,
      counts: (date) => this.countsAsWorkday(date, attendance),
    };
  }

  /**
   * One employee's fixes for the days `from`..`to`, oldest first, plus one gap on
   * either side: a stretch that crosses the first or last midnight needs the fix
   * beyond it, else a day's figures would depend on the period asked for. The
   * caller keeps only its own days. Read newest first, so if the cap is ever hit
   * it is the oldest day that loses points, not today.
   */
  private async fixesOf(employeeId: string, from: Date, to: Date, days: number) {
    const rows = await this.prisma.employeeLocation.findMany({
      where: { employeeId, recordedAt: withGapMargin(from, to) },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: days * ZONE_FIXES_PER_DAY,
      select: {
        recordedAt: true,
        insideAssignedZone: true,
        insideOffice: true,
        hadTerritory: true,
        mahallaName: true,
        accuracy: true,
      },
    });
    return rows.reverse();
  }

  /**
   * One employee, the last `days` days (today included), newest first — every
   * day is present even when nothing was tracked, so the table has no holes.
   */
  async zoneTime(employeeId: string, days = 8): Promise<ZoneTimeView> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, workStartTime: true, workEndTime: true },
    });
    if (!employee) throw new NotFoundException('Xodim topilmadi');

    const today = startOfToday();
    const from = new Date(today.getTime() - (days - 1) * DAY_MS);
    const to = endOfDay(today);
    const [fixes, attendance] = await Promise.all([
      this.fixesOf(employeeId, from, to, days),
      this.attendanceByDay(from, to, employeeId),
    ]);
    const schedule = this.scheduleOf(employee, attendance.get(employeeId));
    const byDate = new Map(zoneDays(fixes, schedule).map((d) => [d.date, d]));
    const out: ZoneDay[] = [];
    for (let i = 0; i < days; i++) {
      const date = localDate(new Date(today.getTime() - i * DAY_MS));
      out.push(byDate.get(date) ?? emptyZoneDay(date));
    }
    return {
      gapMinutes: ZONE_GAP_MS / 60_000,
      workStartTime: employee.workStartTime,
      workEndTime: employee.workEndTime,
      days: out,
    };
  }

  /**
   * Seconds per employee per local day — one SQL pass, the twin of `zoneDays`:
   * imprecise fixes ignored, a segment credited to the earlier fix unless the
   * gap is too long, cut at Tashkent midnight, bucketed zone → office → outside / unassigned,
   * and measured again inside the employee's working hours. Whether those hours
   * count on that day is decided by the caller.
   */
  private zoneSecondsByDay(from: Date, to: Date): Promise<ZoneSecondsRow[]> {
    const gapSec = ZONE_GAP_MS / 1000;
    const { gte, lte } = withGapMargin(from, to);
    return this.prisma.$queryRaw<ZoneSecondsRow[]>`
      WITH fix AS (
        SELECT id, "employeeId",
               ("recordedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tashkent' AS at,
               CASE WHEN "insideAssignedZone" THEN 'zone'
                    WHEN "insideOffice" THEN 'office'
                    WHEN "hadTerritory" THEN 'outside'
                    ELSE 'none' END AS bucket
        FROM employee_locations
        -- A Date is bound as timestamptz; the column is UTC without a zone. Convert
        -- explicitly, or the database's own time zone setting would shift the window.
        WHERE "recordedAt" >= (${gte}::timestamptz AT TIME ZONE 'UTC')
          AND "recordedAt" <= (${lte}::timestamptz AT TIME ZONE 'UTC')
          AND ("accuracy" IS NULL OR "accuracy" <= ${ZONE_MAX_ACCURACY_M})
      ),
      seg AS (
        SELECT "employeeId", bucket, at,
               LEAD(at) OVER (PARTITION BY "employeeId" ORDER BY at, id) AS next_at
        FROM fix
      ),
      part AS (
        SELECT s."employeeId", s.bucket, p.f, p.t, date_trunc('day', p.f) AS midnight
        FROM seg s
        CROSS JOIN LATERAL (
          VALUES (s.at, LEAST(s.next_at, date_trunc('day', s.at) + interval '1 day')),
                 (date_trunc('day', s.at) + interval '1 day', s.next_at)
        ) AS p(f, t)
        WHERE s.next_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (s.next_at - s.at)) <= ${gapSec}
          AND p.t > p.f
      ),
      schedule AS (
        SELECT id,
               CASE WHEN "workStartTime" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
                    THEN split_part("workStartTime", ':', 1)::int * 60 + split_part("workStartTime", ':', 2)::int
                    ELSE 0 END AS start_min,
               CASE WHEN "workEndTime" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
                    THEN split_part("workEndTime", ':', 1)::int * 60 + split_part("workEndTime", ':', 2)::int
                    ELSE 0 END AS end_min
        FROM employees
      ),
      measured AS (
        SELECT p."employeeId", p.bucket, p.midnight,
               EXTRACT(EPOCH FROM (p.t - p.f)) AS secs,
               GREATEST(0, EXTRACT(EPOCH FROM (
                 LEAST(p.t, p.midnight + make_interval(mins =>
                   CASE WHEN s.end_min <= s.start_min THEN 1440 ELSE s.end_min END))
                 - GREATEST(p.f, p.midnight + make_interval(mins =>
                   CASE WHEN s.end_min <= s.start_min THEN 0 ELSE s.start_min END))
               ))) AS work_secs
        FROM part p
        JOIN schedule s ON s.id = p."employeeId"
      )
      SELECT "employeeId",
             to_char(midnight, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(secs) FILTER (WHERE bucket = 'zone'), 0)::float8 AS zone_s,
             COALESCE(SUM(secs) FILTER (WHERE bucket = 'office'), 0)::float8 AS office_s,
             COALESCE(SUM(secs) FILTER (WHERE bucket = 'outside'), 0)::float8 AS outside_s,
             COALESCE(SUM(secs) FILTER (WHERE bucket = 'none'), 0)::float8 AS none_s,
             COALESCE(SUM(work_secs) FILTER (WHERE bucket = 'zone'), 0)::float8 AS work_zone_s,
             COALESCE(SUM(work_secs) FILTER (WHERE bucket = 'office'), 0)::float8 AS work_office_s,
             COALESCE(SUM(work_secs) FILTER (WHERE bucket = 'outside'), 0)::float8 AS work_outside_s,
             COALESCE(SUM(work_secs) FILTER (WHERE bucket = 'none'), 0)::float8 AS work_none_s
      FROM measured
      WHERE to_char(midnight, 'YYYY-MM-DD') BETWEEN ${localDate(from)} AND ${localDate(to)}
      GROUP BY "employeeId", midnight`;
  }

  /**
   * Zone figures for every employee over a period. Rounded day by day, so a total
   * is exactly the sum of the days in the daily sheet.
   */
  private async zoneMinutesByEmployee(
    from: Date,
    to: Date,
    attendance: Map<string, Map<string, DayAttendance>>,
  ): Promise<Map<string, ZoneTotals>> {
    const minutes = (seconds: number) => toMinutes(Math.round(Number(seconds) * 1000));
    const map = new Map<string, ZoneTotals>();
    for (const r of await this.zoneSecondsByDay(from, to)) {
      const cur = map.get(r.employeeId) ?? {
        zone: 0,
        office: 0,
        active: 0,
        workZone: 0,
        workActive: 0,
      };
      const zone = minutes(r.zone_s);
      const office = minutes(r.office_s);
      cur.zone += zone;
      cur.office += office;
      cur.active += zone + office + minutes(r.outside_s) + minutes(r.none_s);
      if (this.countsAsWorkday(r.day, attendance.get(r.employeeId))) {
        const workZone = minutes(r.work_zone_s);
        cur.workZone += workZone;
        cur.workActive +=
          workZone +
          minutes(r.work_office_s) +
          minutes(r.work_outside_s) +
          minutes(r.work_none_s);
      }
      map.set(r.employeeId, cur);
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // Faollik
  // ---------------------------------------------------------------------------

  /** Attendance per employee per local day: first valid keldi, last valid ketdi. */
  private async attendanceByDay(
    from: Date,
    to: Date,
    employeeId?: string,
  ): Promise<Map<string, Map<string, DayAttendance>>> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        recordedAt: { gte: from, lte: to },
        isValid: true,
        ...(employeeId ? { employeeId } : {}),
      },
      select: { employeeId: true, type: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });
    const map = new Map<string, Map<string, DayAttendance>>();
    for (const r of records) {
      const days = map.get(r.employeeId) ?? new Map<string, DayAttendance>();
      const date = localDate(r.recordedAt);
      const e = days.get(date) ?? { in: null, out: null };
      if (r.type === AttendanceType.CHECK_IN) {
        e.in ??= r.recordedAt;
      } else {
        e.out = r.recordedAt;
      }
      days.set(date, e);
      map.set(r.employeeId, days);
    }
    return map;
  }

  /** Work time of one day from attendance (keldi → ketdi), whole minutes. */
  private workMinutesOf(day: DayAttendance | undefined): number {
    return day?.in && day.out && day.out > day.in
      ? toMinutes(day.out.getTime() - day.in.getTime())
      : 0;
  }

  /** Who a period report is about: active staff, plus those archived during/after it. */
  private async activityEmployees(from: Date, employeeId?: string) {
    const [employees, zones] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          OR: [{ isActive: true }, { archivedAt: { gte: from } }],
          ...(employeeId ? { id: employeeId } : {}),
        },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          position: true,
          avatarUrl: true,
          isActive: true,
          assignedMahallaCodes: true,
          workStartTime: true,
          workEndTime: true,
          department: { select: { name: true } },
        },
      }),
      this.prisma.zone.findMany({ where: { kind: 'MAHALLA' }, select: { code: true, nameUzLat: true } }),
    ]);
    const zoneName = new Map(zones.map((z) => [z.code, z.nameUzLat]));
    return employees.map((e) => ({
      ...e,
      mahallas: e.assignedMahallaCodes
        .map((c) => zoneName.get(c) ?? c)
        .sort((a, b) => a.localeCompare(b)),
    }));
  }

  /** Report counts per employee per day. */
  private async reportsByDay(
    fromDay: string,
    toDay: string,
    employeeId?: string,
  ): Promise<Map<string, Map<string, number>>> {
    const reports = await this.prisma.dailyReport.findMany({
      where: { day: { gte: fromDay, lte: toDay }, ...(employeeId ? { employeeId } : {}) },
      select: { employeeId: true, day: true },
    });
    const map = new Map<string, Map<string, number>>();
    for (const r of reports) {
      const days = map.get(r.employeeId) ?? new Map<string, number>();
      days.set(r.day, (days.get(r.day) ?? 0) + 1);
      map.set(r.employeeId, days);
    }
    return map;
  }

  /** Admin: per-employee activity over a period (list badges + Excel). */
  async activity(q: {
    from?: string;
    to?: string;
  }): Promise<{ from: string; to: string; rows: ActivityRow[] }> {
    const { from, to, fromDay, toDay } = this.range(q.from, q.to);
    // Attendance first: it decides on which days the working-hours figures count.
    const attendance = await this.attendanceByDay(from, to);
    const [employees, reports, zoneMin] = await Promise.all([
      this.activityEmployees(from),
      this.reportsByDay(fromDay, toDay),
      this.zoneMinutesByEmployee(from, to, attendance),
    ]);
    const today = localDate(startOfToday());

    const rows: ActivityRow[] = employees.map((e) => {
      const reported = [...(reports.get(e.id)?.values() ?? [])];
      const days = [...(attendance.get(e.id)?.entries() ?? [])];
      const zone = zoneMin.get(e.id);
      return {
        employeeId: e.id,
        fullName: e.fullName,
        position: e.position,
        department: e.department?.name ?? null,
        avatarUrl: e.avatarUrl,
        mahallas: e.mahallas,
        workStartTime: e.workStartTime,
        workEndTime: e.workEndTime,
        reportDays: reported.length,
        reportCount: reported.reduce((sum, n) => sum + n, 0),
        zoneMinutes: zone?.zone ?? 0,
        activeMinutes: zone?.active ?? 0,
        workMinutes: days.reduce((sum, [, d]) => sum + this.workMinutesOf(d), 0),
        daysWorked: days.filter(([, d]) => d.in).length,
        officeMinutes: zone?.office ?? 0,
        workZoneMinutes: zone?.workZone ?? 0,
        workActiveMinutes: zone?.workActive ?? 0,
        missingCheckOutDays: days.filter(([date, d]) => d.in && !d.out && date !== today)
          .length,
        archived: !e.isActive,
      };
    });
    return { from: fromDay, to: toDay, rows };
  }

  /** Admin: every employee × every day of a period (the day-by-day Excel sheet). */
  async activityDaily(q: { from?: string; to?: string; employeeId?: string }): Promise<{
    from: string;
    to: string;
    gapMinutes: number;
    rows: ActivityDailyRow[];
  }> {
    const { from, to, fromDay, toDay } = this.range(
      q.from,
      q.to,
      MAX_DAILY_DAYS - 1,
      MAX_DAILY_DAYS,
    );
    const dates: string[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dates.push(localDate(d));
    }
    const [employees, reports, attendance] = await Promise.all([
      this.activityEmployees(from, q.employeeId),
      this.reportsByDay(fromDay, toDay, q.employeeId),
      this.attendanceByDay(from, to, q.employeeId),
    ]);

    const rows: ActivityDailyRow[] = [];
    // One employee at a time: a month of fixes for everyone would not fit in memory.
    for (const e of employees) {
      const own = attendance.get(e.id);
      const fixes = await this.fixesOf(e.id, from, to, dates.length);
      const tracked = new Map(
        zoneDays(fixes, this.scheduleOf(e, own)).map((d) => [d.date, d]),
      );
      rows.push({
        employeeId: e.id,
        fullName: e.fullName,
        position: e.position,
        department: e.department?.name ?? null,
        mahallas: e.mahallas,
        workStartTime: e.workStartTime,
        workEndTime: e.workEndTime,
        archived: !e.isActive,
        days: dates.map((date) => {
          const zone = tracked.get(date) ?? emptyZoneDay(date);
          const att = own?.get(date);
          return {
            date,
            checkInAt: att?.in ?? null,
            checkOutAt: att?.out ?? null,
            workMinutes: this.workMinutesOf(att),
            reportCount: reports.get(e.id)?.get(date) ?? 0,
            zoneMinutes: zone.zoneMinutes,
            officeMinutes: zone.officeMinutes,
            outsideMinutes: zone.outsideMinutes,
            unassignedMinutes: zone.unassignedMinutes,
            activeMinutes: zone.activeMinutes,
            workZoneMinutes: zone.workZoneMinutes,
            workActiveMinutes: zone.workActiveMinutes,
            firstAt: zone.firstAt,
            lastAt: zone.lastAt,
            stretches: zone.stretches,
          };
        }),
      });
    }
    return { from: fromDay, to: toDay, gapMinutes: ZONE_GAP_MS / 60_000, rows };
  }
}
