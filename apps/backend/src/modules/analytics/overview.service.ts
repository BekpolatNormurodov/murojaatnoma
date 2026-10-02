import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  AttendanceType,
  Priority,
  RequestCategory,
  RequestStatus,
} from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { categoryOf, SLA_HOURS, titleOf } from '../applications/applications.service';
import { mapCategory } from '../requests/requests.service';
import { ZonesService } from '../zones/zones.service';
import { AttendanceService } from '../attendance/attendance.service';
import {
  CategoryLoad,
  EmployeeLoad,
  MahallaLoad,
  MurojaatPin,
  OverviewResponse,
  RecentMurojaat,
  TrendPoint,
  AttendanceDayPoint,
  WorkforceKpis,
} from './overview.types';

const DAY_MS = 86_400_000;
const WEEKDAYS_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const CATEGORY_ORDER: RequestCategory[] = [
  RequestCategory.kommunal,
  RequestCategory.yol,
  RequestCategory.suv,
  RequestCategory.elektr,
  RequestCategory.tozalik,
  RequestCategory.obodonlashtirish,
];
const APP_STATUS: Record<ApplicationStatus, RequestStatus> = {
  [ApplicationStatus.NEW]: RequestStatus.new,
  [ApplicationStatus.IN_PROGRESS]: RequestStatus.in_progress,
  [ApplicationStatus.RESOLVED]: RequestStatus.resolved,
  [ApplicationStatus.REJECTED]: RequestStatus.rejected,
};
const MAX_PINS = 400;

/** One murojaat, whichever table it lives in (citizen Application or legacy CitizenRequest). */
interface Row {
  id: string;
  title: string;
  category: RequestCategory;
  status: RequestStatus;
  priority: Priority;
  createdAt: Date;
  resolvedAt: Date | null;
  dueAt: Date;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  source: 'citizen' | 'legacy';
  kind: 'ariza' | 'shikoyat' | null;
  citizenName: string;
  address: string;
  assignee: { id: string; fullName: string; avatarUrl: string | null } | null;
}

const isOpen = (r: Row) => r.status === RequestStatus.new || r.status === RequestStatus.in_progress;
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Boshqaruv paneli aggregations — see {@link OverviewResponse}. Reads both
 * murojaat tables once and folds everything in memory (a district produces
 * thousands of murojaats, not millions), so the dashboard costs one round trip
 * and every widget agrees with every other one and with the Murojaatlar page.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly attendance: AttendanceService,
  ) {}

  async overview(): Promise<OverviewResponse> {
    const now = new Date();
    const [rows, workforce, attendanceWeek] = await Promise.all([
      this.loadRows(),
      this.workforce(now),
      this.attendanceWeek(now),
    ]);
    const nowMs = now.getTime();
    const overdue = (r: Row) => isOpen(r) && r.dueAt.getTime() < nowMs;

    // ── Status / SLA KPIs ──────────────────────────────────────────────
    const count = (s: RequestStatus) => rows.filter((r) => r.status === s).length;
    const resolvedRows = rows.filter((r) => r.status === RequestStatus.resolved);
    const open = rows.filter(isOpen);
    const resolutionHours = resolvedRows
      .filter((r) => r.resolvedAt)
      .map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    const withinSla = resolvedRows.filter(
      (r) => r.resolvedAt && r.resolvedAt.getTime() <= r.dueAt.getTime(),
    ).length;
    // Muddati o'tib hali ochiq turganlar ham SLA buzilishi — avval ular
    // hisobga olinmay, 14 ta kechikkan bo'lsa ham "100%" chiqardi.
    const overdueOpen = open.filter(overdue).length;
    const lateResolved = resolutionHours.length - withinSla;
    const rated = rows.filter((r) => r.rating != null);
    const inWindow = (d: Date | null, fromDays: number, toDays: number) =>
      !!d && d.getTime() > nowMs - fromDays * DAY_MS && d.getTime() <= nowMs - toDays * DAY_MS;

    const openByPriority: Record<Priority, number> = { high: 0, medium: 0, low: 0 };
    for (const r of open) openByPriority[r.priority] += 1;

    const murojaat = {
      total: rows.length,
      new: count(RequestStatus.new),
      inProgress: count(RequestStatus.in_progress),
      resolved: resolvedRows.length,
      rejected: count(RequestStatus.rejected),
      open: open.length,
      overdue: open.filter(overdue).length,
      dueSoon: open.filter((r) => !overdue(r) && r.dueAt.getTime() - nowMs <= DAY_MS).length,
      unassigned: rows.filter(
        (r) => r.source === 'citizen' && r.status === RequestStatus.new && !r.assignee,
      ).length,
      resolutionRate: pct(resolvedRows.length, rows.length),
      slaRate: pct(withinSla, withinSla + lateResolved + overdueOpen),
      avgResolutionHours: resolutionHours.length
        ? round1(resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length)
        : null,
      avgRating: rated.length
        ? round1(rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length)
        : null,
      ratedCount: rated.length,
      created30: rows.filter((r) => inWindow(r.createdAt, 30, 0)).length,
      createdPrev30: rows.filter((r) => inWindow(r.createdAt, 60, 30)).length,
      resolved30: rows.filter((r) => inWindow(r.resolvedAt, 30, 0)).length,
      resolvedPrev30: rows.filter((r) => inWindow(r.resolvedAt, 60, 30)).length,
      openByPriority,
      bySource: {
        citizen: rows.filter((r) => r.source === 'citizen').length,
        legacy: rows.filter((r) => r.source === 'legacy').length,
      },
      byKind: {
        ariza: {
          total: rows.filter((r) => r.kind !== 'shikoyat').length,
          open: open.filter((r) => r.kind !== 'shikoyat').length,
        },
        shikoyat: {
          total: rows.filter((r) => r.kind === 'shikoyat').length,
          open: open.filter((r) => r.kind === 'shikoyat').length,
        },
      },
      sla: { onTime: withinSla, late: lateResolved, overdueOpen },
    };

    // ── Activity: when do citizens write (last 90 days) ────────────────
    const byHour = Array.from({ length: 24 }, () => 0);
    const byWeekday = Array.from({ length: 7 }, () => 0);
    for (const r of rows) {
      if (r.createdAt.getTime() < nowMs - 90 * DAY_MS) continue;
      byHour[r.createdAt.getHours()] += 1;
      byWeekday[(r.createdAt.getDay() + 6) % 7] += 1; // Du=0 … Ya=6
    }

    // ── Categories ─────────────────────────────────────────────────────
    const categories: CategoryLoad[] = CATEGORY_ORDER.map((category) => {
      const inCat = rows.filter((r) => r.category === category);
      return { category, total: inCat.length, open: inCat.filter(isOpen).length };
    });

    // ── Mahallas + map pins (only murojaats with real coordinates) ─────
    const mahallaAgg = new Map<string, MahallaLoad>();
    const pins: MurojaatPin[] = [];
    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue;
      const where = await this.zones.locate(r.lat, r.lng);
      if (!where.insideDistrict && !where.mahalla) continue; // outside the tuman
      const m = where.mahalla;
      if (m) {
        const agg = mahallaAgg.get(m.code) ?? {
          code: m.code,
          name: m.nameUzLat,
          total: 0,
          open: 0,
          overdue: 0,
        };
        agg.total += 1;
        if (isOpen(r)) agg.open += 1;
        if (overdue(r)) agg.overdue += 1;
        mahallaAgg.set(m.code, agg);
      }
      if (isOpen(r) && pins.length < MAX_PINS) {
        pins.push({
          id: r.id,
          title: r.title,
          status: r.status,
          priority: r.priority,
          category: r.category,
          lat: r.lat,
          lng: r.lng,
          overdue: overdue(r),
          createdAt: r.createdAt.toISOString(),
          mahallaCode: m?.code ?? null,
        });
      }
    }
    const mahallas = [...mahallaAgg.values()].sort(
      (a, b) => b.open - a.open || b.overdue - a.overdue || b.total - a.total,
    );

    // ── Per-employee load (real employees ↔ citizen murojaats) ─────────
    const empAgg = new Map<string, EmployeeLoad & { ratingSum: number; ratingN: number }>();
    for (const r of rows) {
      if (!r.assignee) continue;
      const e = empAgg.get(r.assignee.id) ?? {
        id: r.assignee.id,
        fullName: r.assignee.fullName,
        avatarUrl: r.assignee.avatarUrl,
        position: '',
        open: 0,
        overdue: 0,
        resolved: 0,
        avgRating: null,
        ratingSum: 0,
        ratingN: 0,
      };
      if (isOpen(r)) e.open += 1;
      if (overdue(r)) e.overdue += 1;
      if (r.status === RequestStatus.resolved) e.resolved += 1;
      if (r.rating != null) {
        e.ratingSum += r.rating;
        e.ratingN += 1;
      }
      empAgg.set(r.assignee.id, e);
    }
    const positions = new Map(workforce.people.map((p) => [p.id, p.position]));
    const topEmployees: EmployeeLoad[] = [...empAgg.values()]
      .map(({ ratingSum, ratingN, ...e }) => ({
        ...e,
        position: positions.get(e.id) ?? '',
        avgRating: ratingN ? round1(ratingSum / ratingN) : null,
      }))
      .sort((a, b) => b.resolved - a.resolved || (b.avgRating ?? 0) - (a.avgRating ?? 0) || a.overdue - b.overdue)
      .slice(0, 8);

    // ── Recent ─────────────────────────────────────────────────────────
    const recent: RecentMurojaat[] = [...rows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        status: r.status,
        priority: r.priority,
        citizenName: r.citizenName,
        address: r.address,
        createdAt: r.createdAt.toISOString(),
        dueAt: r.source === 'citizen' ? r.dueAt.toISOString() : null,
        overdue: overdue(r),
        source: r.source,
        kind: r.kind,
        assignee: r.assignee,
      }));

    return {
      generatedAt: now.toISOString(),
      murojaat,
      trend: { daily: this.dailyTrend(rows, now), monthly: this.monthlyTrend(rows, now) },
      activity: { byHour, byWeekday },
      attendanceWeek,
      categories,
      workforce: workforce.kpis,
      topEmployees,
      mahallas,
      pins,
      recent,
    };
  }

  /** Both murojaat tables, normalized. */
  private async loadRows(): Promise<Row[]> {
    const [apps, legacy] = await Promise.all([
      this.prisma.application.findMany({
        select: {
          id: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
          dueAt: true,
          rating: true,
          lat: true,
          lng: true,
          address: true,
          district: true,
          kind: true,
          applicantFullName: true,
          assignedEmployee: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.citizenRequest.findMany({
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
          responseHours: true,
          feedback: true,
          lat: true,
          lng: true,
          address: true,
          citizenName: true,
        },
      }),
    ]);

    const sla = (p: Priority, from: Date) => new Date(from.getTime() + SLA_HOURS[p] * 3_600_000);
    const out: Row[] = apps.map((a) => ({
      id: a.id,
      title: titleOf(a.subject),
      category: mapCategory(`${categoryOf(a.subject)} ${a.subject} ${a.description}`),
      status: APP_STATUS[a.status],
      priority: a.priority,
      createdAt: a.createdAt,
      resolvedAt: a.resolvedAt,
      dueAt: a.dueAt ?? sla(a.priority, a.createdAt),
      rating: a.rating,
      lat: a.lat,
      lng: a.lng,
      source: 'citizen',
      kind: a.kind === 'SHIKOYAT' ? 'shikoyat' : 'ariza',
      citizenName: a.applicantFullName,
      address: a.address ?? a.district ?? '',
      assignee: a.assignedEmployee,
    }));
    for (const r of legacy) {
      const resolvedAt =
        r.resolvedAt ??
        (r.status === RequestStatus.resolved && r.responseHours != null
          ? new Date(r.createdAt.getTime() + r.responseHours * 3_600_000)
          : null);
      out.push({
        id: r.id,
        title: r.title,
        category: r.category,
        status: r.status,
        priority: r.priority,
        createdAt: r.createdAt,
        resolvedAt,
        dueAt: sla(r.priority, r.createdAt),
        rating: r.feedback && r.feedback >= 1 && r.feedback <= 5 ? r.feedback : null,
        lat: r.lat,
        lng: r.lng,
        source: 'legacy',
        kind: null,
        citizenName: r.citizenName,
        address: r.address,
        assignee: null,
      });
    }
    return out;
  }

  /**
   * Oxirgi 7 kun davomati — har kun uchun davomat taxtasining o'zi
   * (ta'til, dam olish kuni, kechikish qoidalari bilan bir xil).
   */
  private async attendanceWeek(now: Date): Promise<AttendanceDayPoint[]> {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return d;
    });
    const boards = await Promise.all(
      days.map((d) => this.attendance.today({ date: dayKey(d) }).catch(() => null)),
    );
    return days.map((d, i) => {
      const s = boards[i]?.summary;
      const checkedIn = s?.checkedIn ?? 0;
      const late = s?.lateTotal ?? 0;
      return {
        date: dayKey(d),
        label: `${WEEKDAYS_UZ[(d.getDay() + 6) % 7]} ${d.getDate()}`,
        isWorkday: boards[i]?.isWorkday ?? true,
        onTime: Math.max(0, checkedIn - late),
        late,
        absent: s?.absent ?? 0,
        onLeave: s?.onLeave ?? 0,
        total: s?.total ?? 0,
      };
    });
  }

  private dailyTrend(rows: Row[], now: Date): TrendPoint[] {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const points = new Map<string, TrendPoint>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      points.set(dayKey(d), {
        key: dayKey(d),
        label: `${d.getDate()} ${MONTHS_UZ[d.getMonth()]}`,
        created: 0,
        resolved: 0,
      });
    }
    for (const r of rows) {
      const c = points.get(dayKey(r.createdAt));
      if (c) c.created += 1;
      const s = r.resolvedAt ? points.get(dayKey(r.resolvedAt)) : undefined;
      if (s) s.resolved += 1;
    }
    return [...points.values()];
  }

  private monthlyTrend(rows: Row[], now: Date): TrendPoint[] {
    const points = new Map<string, TrendPoint>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      points.set(monthKey(d), {
        key: monthKey(d),
        label: `${MONTHS_UZ[d.getMonth()]}${d.getMonth() === 0 || i === 11 ? ` ${String(d.getFullYear()).slice(2)}` : ''}`,
        created: 0,
        resolved: 0,
      });
    }
    for (const r of rows) {
      const c = points.get(monthKey(r.createdAt));
      if (c) c.created += 1;
      const s = r.resolvedAt ? points.get(monthKey(r.resolvedAt)) : undefined;
      if (s) s.resolved += 1;
    }
    return [...points.values()];
  }

  private async workforce(
    now: Date,
  ): Promise<{ kpis: WorkforceKpis; people: { id: string; position: string }[] }> {
    const staleMinutes = this.config.get('location', { infer: true }).staleMinutes;
    const threshold = now.getTime() - staleMinutes * 60_000;
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [people, checkIns] = await Promise.all([
      this.prisma.employee.findMany({
        where: { isActive: true },
        select: {
          id: true,
          position: true,
          lastLocationAt: true,
          lastInsideAssignedZone: true,
          lastInsideOffice: true,
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { type: AttendanceType.CHECK_IN, isValid: true, recordedAt: { gte: dayStart } },
        select: { employeeId: true, isLate: true },
        orderBy: { recordedAt: 'asc' },
      }),
    ]);

    const active = new Set(people.map((p) => p.id));
    const firstCheckIn = new Map<string, boolean>(); // employeeId -> isLate
    for (const c of checkIns) {
      if (active.has(c.employeeId) && !firstCheckIn.has(c.employeeId)) {
        firstCheckIn.set(c.employeeId, c.isLate);
      }
    }
    const late = [...firstCheckIn.values()].filter(Boolean).length;
    const reporting = people.filter(
      (p) => p.lastLocationAt && p.lastLocationAt.getTime() >= threshold,
    );
    const insideZone = reporting.filter((p) => p.lastInsideAssignedZone || p.lastInsideOffice).length;

    return {
      people: people.map((p) => ({ id: p.id, position: p.position })),
      kpis: {
        total: people.length,
        checkedIn: firstCheckIn.size,
        lateToday: late,
        notCheckedIn: people.length - firstCheckIn.size,
        reportingNow: reporting.length,
        insideZone,
        outsideZone: reporting.length - insideZone,
        stale: people.filter((p) => p.lastLocationAt && p.lastLocationAt.getTime() < threshold).length,
        neverReported: people.filter((p) => !p.lastLocationAt).length,
        staleMinutes,
        onTimeRate: pct(firstCheckIn.size - late, firstCheckIn.size),
      },
    };
  }
}
