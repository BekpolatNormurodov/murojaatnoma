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
import { ZONE_GAP_MS, ZoneDay, zoneDays } from './zone-time';

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
  /** Biriktirilgan mahallalar nomi (bo'sh = butun tuman). */
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
}

/** Longest period one activity/list request may span. */
const MAX_RANGE_DAYS = 92;
/** Rows read for one employee's zone-time window (7 days at a fix / 30 s ≈ 20 000). */
const ZONE_SCAN_CAP = 60_000;
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

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ---------------------------------------------------------------------------
  // Period helpers
  // ---------------------------------------------------------------------------

  /** Validated inclusive local-day range; defaults to the last 7 days. */
  private range(from?: string, to?: string): { from: Date; to: Date; fromDay: string; toDay: string } {
    const today = startOfToday();
    const toDate = to ? parseDay(to) : today;
    const fromDate = from ? parseDay(from) : new Date((toDate ?? today).getTime() - 6 * DAY_MS);
    if (!toDate || !fromDate) throw new BadRequestException("Sana noto'g'ri");
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException("Boshlanish sanasi tugash sanasidan keyin bo'lmasin");
    }
    if ((toDate.getTime() - fromDate.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Davr ${MAX_RANGE_DAYS} kundan oshmasin`);
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

  /** Admin: reports in a period (optionally one employee), newest first. */
  async list(q: { from?: string; to?: string; employeeId?: string }): Promise<DailyReportView[]> {
    const { fromDay, toDay } = this.range(q.from, q.to);
    const rows = await this.prisma.dailyReport.findMany({
      where: {
        day: { gte: fromDay, lte: toDay },
        ...(q.employeeId ? { employeeId: q.employeeId } : {}),
      },
      orderBy: [{ day: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
      include: { employee: { select: { fullName: true, position: true, avatarUrl: true } } },
    });
    return rows.map((r) => this.view(r));
  }

  // ---------------------------------------------------------------------------
  // Hududda yurgan vaqt
  // ---------------------------------------------------------------------------

  /**
   * One employee, the last `days` days (today included), newest first — every
   * day is present even when nothing was tracked, so the table has no holes.
   */
  async zoneTime(employeeId: string, days = 7): Promise<{ gapMinutes: number; days: ZoneDay[] }> {
    const exists = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Xodim topilmadi');

    const today = startOfToday();
    const from = new Date(today.getTime() - (days - 1) * DAY_MS);
    const fixes = await this.prisma.employeeLocation.findMany({
      where: { employeeId, recordedAt: { gte: from, lte: endOfDay(today) } },
      orderBy: { recordedAt: 'asc' },
      take: ZONE_SCAN_CAP,
      select: { recordedAt: true, insideAssignedZone: true, mahallaName: true },
    });
    const byDate = new Map(zoneDays(fixes).map((d) => [d.date, d]));
    const out: ZoneDay[] = [];
    for (let i = 0; i < days; i++) {
      const date = localDate(new Date(today.getTime() - i * DAY_MS));
      out.push(
        byDate.get(date) ?? {
          date,
          zoneMinutes: 0,
          outsideMinutes: 0,
          activeMinutes: 0,
          firstAt: null,
          lastAt: null,
          stretches: [],
          byMahalla: [],
        },
      );
    }
    return { gapMinutes: ZONE_GAP_MS / 60_000, days: out };
  }

  /** Zone/active minutes for every employee over a period — one SQL pass. */
  private async zoneMinutesByEmployee(
    from: Date,
    to: Date,
  ): Promise<Map<string, { zone: number; active: number }>> {
    const gapSec = ZONE_GAP_MS / 1000;
    const rows = await this.prisma.$queryRaw<{ employeeId: string; zone_s: number | null; active_s: number | null }[]>`
      WITH seg AS (
        SELECT "employeeId",
               "insideAssignedZone" AS inside,
               EXTRACT(EPOCH FROM (
                 LEAD("recordedAt") OVER (PARTITION BY "employeeId" ORDER BY "recordedAt") - "recordedAt"
               )) AS secs
        FROM employee_locations
        WHERE "recordedAt" >= ${from} AND "recordedAt" <= ${to}
      )
      SELECT "employeeId",
             COALESCE(SUM(secs) FILTER (WHERE inside), 0)::float8 AS zone_s,
             COALESCE(SUM(secs), 0)::float8 AS active_s
      FROM seg
      WHERE secs IS NOT NULL AND secs > 0 AND secs <= ${gapSec}
      GROUP BY "employeeId"`;
    const map = new Map<string, { zone: number; active: number }>();
    for (const r of rows) {
      map.set(r.employeeId, {
        zone: Math.round(Number(r.zone_s ?? 0) / 60),
        active: Math.round(Number(r.active_s ?? 0) / 60),
      });
    }
    return map;
  }

  /** Work time from attendance: each day's first valid keldi → last valid ketdi. */
  private async workByEmployee(from: Date, to: Date): Promise<Map<string, { minutes: number; days: number }>> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { recordedAt: { gte: from, lte: to }, isValid: true },
      select: { employeeId: true, type: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });
    const perDay = new Map<string, { in: Date | null; out: Date | null }>();
    for (const r of records) {
      const key = `${r.employeeId}|${localDate(r.recordedAt)}`;
      const e = perDay.get(key) ?? { in: null, out: null };
      if (r.type === AttendanceType.CHECK_IN) {
        e.in ??= r.recordedAt;
      } else {
        e.out = r.recordedAt;
      }
      perDay.set(key, e);
    }
    const map = new Map<string, { minutes: number; days: number }>();
    for (const [key, e] of perDay) {
      if (!e.in) continue;
      const id = key.slice(0, key.indexOf('|'));
      const cur = map.get(id) ?? { minutes: 0, days: 0 };
      cur.days += 1;
      if (e.out && e.out > e.in) cur.minutes += (e.out.getTime() - e.in.getTime()) / 60_000;
      map.set(id, cur);
    }
    for (const v of map.values()) v.minutes = Math.round(v.minutes);
    return map;
  }

  /** Admin: per-employee activity over a period (list badges + Excel). */
  async activity(q: { from?: string; to?: string }): Promise<{ from: string; to: string; rows: ActivityRow[] }> {
    const { from, to, fromDay, toDay } = this.range(q.from, q.to);
    const [employees, zones, reports, zoneMin, work] = await Promise.all([
      this.prisma.employee.findMany({
        where: { isActive: true },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          position: true,
          avatarUrl: true,
          assignedMahallaCodes: true,
          workStartTime: true,
          workEndTime: true,
          department: { select: { name: true } },
        },
      }),
      this.prisma.zone.findMany({ where: { kind: 'MAHALLA' }, select: { code: true, nameUzLat: true } }),
      this.prisma.dailyReport.findMany({
        where: { day: { gte: fromDay, lte: toDay } },
        select: { employeeId: true, day: true },
      }),
      this.zoneMinutesByEmployee(from, to),
      this.workByEmployee(from, to),
    ]);

    const zoneName = new Map(zones.map((z) => [z.code, z.nameUzLat]));
    const rep = new Map<string, { days: Set<string>; count: number }>();
    for (const r of reports) {
      const cur = rep.get(r.employeeId) ?? { days: new Set<string>(), count: 0 };
      cur.days.add(r.day);
      cur.count += 1;
      rep.set(r.employeeId, cur);
    }

    const rows: ActivityRow[] = employees.map((e) => ({
      employeeId: e.id,
      fullName: e.fullName,
      position: e.position,
      department: e.department?.name ?? null,
      avatarUrl: e.avatarUrl,
      mahallas: e.assignedMahallaCodes.map((c) => zoneName.get(c) ?? c).sort((a, b) => a.localeCompare(b)),
      workStartTime: e.workStartTime,
      workEndTime: e.workEndTime,
      reportDays: rep.get(e.id)?.days.size ?? 0,
      reportCount: rep.get(e.id)?.count ?? 0,
      zoneMinutes: zoneMin.get(e.id)?.zone ?? 0,
      activeMinutes: zoneMin.get(e.id)?.active ?? 0,
      workMinutes: work.get(e.id)?.minutes ?? 0,
      daysWorked: work.get(e.id)?.days ?? 0,
    }));
    return { from: fromDay, to: toDay, rows };
  }
}
