import { Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { DayStat, EmployeePeriodStats, EmployeeStatsService } from './employee-stats.service';

/** Everything the worker-app Home needs, in ONE request (weak-network friendly). */
export interface MyDashboard {
  generatedAt: string;
  month: { from: string; to: string };
  attendance: {
    totalHours: number;
    daysPresent: number;
    daysLate: number;
    totalLateMinutes: number;
    /** Mon–Sat work days elapsed this month (incl. today). */
    workDaysSoFar: number;
    /** % of present days that were on time. */
    onTimeRate: number | null;
    /** % of elapsed work days attended. */
    attendanceRate: number | null;
    /** Average first check-in "HH:mm" this month. */
    avgCheckIn: string | null;
    /** Consecutive on-time work days up to today. */
    onTimeStreak: number;
    /** Rank by on-time rate among active employees (1 = best). */
    rank: number | null;
    rankOf: number;
    /** Last 30 days, oldest first. */
    last30: Array<Pick<DayStat, 'date' | 'hours' | 'late' | 'lateMinutes'> & { present: boolean }>;
  };
  murojaat: {
    open: number;
    newToday: number;
    overdue: number;
    resolvedThisMonth: number;
    avgResolutionHours: number | null;
    avgRating: number | null;
    ratedCount: number;
  };
  money: { salaryBase: number | null; salaryNet: number | null; premyaThisMonth: number; points: number };
  today: { meetings: number; unreadChat: number; unreadNotifications: number };
  recent: Array<{ id: string; title: string; body: string; type: string; createdAt: string; isRead: boolean }>;
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class MyDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: EmployeeStatsService,
    private readonly chat: ChatService,
  ) {}

  async build(employeeId: string): Promise<MyDashboard> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const d30 = new Date(dayStart.getTime() - 29 * 86_400_000);
    const from = localDay(monthStart);
    const to = localDay(now);
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      month,
      last30,
      open,
      newToday,
      overdue,
      resolvedRows,
      rating,
      salary,
      premya,
      points,
      meetings,
      convs,
      unreadNotifications,
      recent,
      employees,
    ] = await Promise.all([
      this.stats.periodStats(employeeId, from, to),
      this.stats.periodStats(employeeId, localDay(d30), to),
      this.prisma.application.count({
        where: {
          assignedEmployeeId: employeeId,
          status: { in: [ApplicationStatus.NEW, ApplicationStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.applicationEvent.count({
        where: { toEmployeeId: employeeId, type: 'ASSIGNED', createdAt: { gte: dayStart } },
      }),
      this.prisma.application.count({
        where: {
          assignedEmployeeId: employeeId,
          status: { in: [ApplicationStatus.NEW, ApplicationStatus.IN_PROGRESS] },
          dueAt: { lt: now },
        },
      }),
      this.prisma.application.findMany({
        where: {
          assignedEmployeeId: employeeId,
          status: ApplicationStatus.RESOLVED,
          resolvedAt: { gte: monthStart },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
      this.prisma.application.aggregate({
        where: { assignedEmployeeId: employeeId, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.employeeSalary.findUnique({
        where: {
          employeeId_year_month: { employeeId, year: now.getFullYear(), month: now.getMonth() + 1 },
        },
      }),
      this.prisma.bonus.aggregate({ where: { employeeId, month: monthStr }, _sum: { amount: true } }),
      this.prisma.pointsEntry.aggregate({ where: { employeeId }, _sum: { delta: true } }),
      this.prisma.meeting.count({ where: { startAt: { gte: dayStart, lt: dayEnd } } }),
      this.chat.findMyConversations(employeeId).catch(() => []),
      this.prisma.notification.count({ where: { employeeId, isRead: false } }),
      this.prisma.notification.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.employee.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);

    const workDaysSoFar = countWorkDays(monthStart, now);
    const onTimeDays = month.daysPresent - month.daysLate;
    const hours = resolvedRows
      .filter((r) => r.resolvedAt)
      .map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);

    // On-time ranking among active employees (cheap: this month only).
    const rank = await this.onTimeRank(employeeId, employees.map((e) => e.id), from, to, month);

    return {
      generatedAt: now.toISOString(),
      month: { from, to },
      attendance: {
        totalHours: round1(month.totalHours),
        daysPresent: month.daysPresent,
        daysLate: month.daysLate,
        totalLateMinutes: month.totalLateMinutes,
        workDaysSoFar,
        onTimeRate: month.daysPresent ? Math.round((onTimeDays / month.daysPresent) * 100) : null,
        attendanceRate: workDaysSoFar ? Math.min(100, Math.round((month.daysPresent / workDaysSoFar) * 100)) : null,
        avgCheckIn: avgClock(month.days.map((d) => d.checkIn).filter((x): x is Date => !!x)),
        onTimeStreak: streak(last30.days),
        rank: rank.rank,
        rankOf: rank.of,
        last30: fill30(d30, last30.days),
      },
      murojaat: {
        open,
        newToday,
        overdue,
        resolvedThisMonth: resolvedRows.length,
        avgResolutionHours: hours.length ? round1(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
        avgRating: rating._avg.rating != null ? round1(rating._avg.rating) : null,
        ratedCount: rating._count.rating,
      },
      money: {
        salaryBase: salary?.amount ?? null,
        salaryNet: salary ? salary.amount + salary.bonus - salary.penalty : null,
        premyaThisMonth: premya._sum.amount ?? 0,
        points: points._sum.delta ?? 0,
      },
      today: {
        meetings,
        unreadChat: convs.reduce((sum, c) => sum + c.unreadCount, 0),
        unreadNotifications,
      },
      recent: recent.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        createdAt: n.createdAt.toISOString(),
        isRead: n.isRead,
      })),
    };
  }

  private async onTimeRank(
    me: string,
    ids: string[],
    from: string,
    to: string,
    mine: EmployeePeriodStats,
  ): Promise<{ rank: number | null; of: number }> {
    if (!mine.daysPresent || ids.length > 300) return { rank: null, of: ids.length };
    const score = (s: EmployeePeriodStats) =>
      s.daysPresent ? (s.daysPresent - s.daysLate) / s.daysPresent + s.daysPresent / 1000 : -1;
    const all = await Promise.all(
      ids.filter((id) => id !== me).map((id) => this.stats.periodStats(id, from, to).catch(() => null)),
    );
    const myScore = score(mine);
    const better = all.filter((s) => s && score(s) > myScore).length;
    return { rank: better + 1, of: ids.length };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Mon–Sat days from `from` to `to` inclusive (Sunday off — matches the schedule). */
function countWorkDays(from: Date, to: Date): number {
  let n = 0;
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86_400_000)) {
    if (d.getDay() !== 0) n++;
  }
  return n;
}

function avgClock(times: Date[]): string | null {
  if (!times.length) return null;
  const mins = times.reduce((a, t) => a + t.getHours() * 60 + t.getMinutes(), 0) / times.length;
  const m = Math.round(mins);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Consecutive on-time PRESENT work days, walking back from the latest day. */
function streak(days: DayStat[]): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let n = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (d.getDay() === 0) continue; // Sunday
    const s = byDate.get(localDay(d));
    if (!s || !s.checkIn) {
      if (i === 0) continue; // today not checked-in yet doesn't break it
      break;
    }
    if (s.late) break;
    n++;
  }
  return n;
}

function fill30(start: Date, days: DayStat[]): MyDashboard['attendance']['last30'] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: MyDashboard['attendance']['last30'] = [];
  for (let i = 0; i < 30; i++) {
    const key = localDay(new Date(start.getTime() + i * 86_400_000));
    const s = byDate.get(key);
    out.push({
      date: key,
      present: !!s?.checkIn,
      hours: s ? round1(s.hours) : 0,
      late: s?.late ?? false,
      lateMinutes: s?.lateMinutes ?? 0,
    });
  }
  return out;
}
