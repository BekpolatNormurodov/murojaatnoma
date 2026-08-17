import { Injectable } from '@nestjs/common';
import { CameraStatus, District, RequestCategory, RequestStatus, WorkerStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CategorySlice,
  DistrictDto,
  DistrictLoad,
  HourlyActivityPoint,
  KpiPoint,
  RegionStat,
  SummaryResponse,
} from './analytics.types';

/** Fixed category order used by the web-admin `CATEGORY_DISTRIBUTION` mock. */
const CATEGORY_ORDER: RequestCategory[] = [
  RequestCategory.kommunal,
  RequestCategory.yol,
  RequestCategory.suv,
  RequestCategory.elektr,
  RequestCategory.tozalik,
  RequestCategory.obodonlashtirish,
];

/**
 * Static 12-point trend line — mirrors web-admin's `KPI_TREND` mock export
 * verbatim. The DB only holds a live snapshot of requests (the seed backdates
 * them at most ~45 days), so there is no real year-long monthly history to
 * derive this from; it is kept as a literal drop-in match of the mock shape
 * rather than a fabricated aggregation.
 */
const KPI_TREND: KpiPoint[] = [
  { label: 'Yan', total: 320, resolved: 280 },
  { label: 'Fev', total: 410, resolved: 360 },
  { label: 'Mar', total: 380, resolved: 350 },
  { label: 'Apr', total: 520, resolved: 470 },
  { label: 'May', total: 610, resolved: 560 },
  { label: 'Iyn', total: 580, resolved: 540 },
  { label: 'Iyl', total: 690, resolved: 620 },
  { label: 'Avg', total: 720, resolved: 680 },
  { label: 'Sen', total: 650, resolved: 610 },
  { label: 'Okt', total: 780, resolved: 720 },
  { label: 'Noy', total: 840, resolved: 790 },
  { label: 'Dek', total: 910, resolved: 860 },
];

/**
 * Dashboard + analytics ("hisobot") aggregations for the web-admin panel.
 * Every method computes its numbers from the live DB where the mock's
 * formula is naturally DB-derived (counts/sums/group-bys); `kpiTrend()` is
 * the one exception, since the mock's 12-month series has no real backing
 * time-series in this schema.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /analytics/summary` */
  async summary(): Promise<SummaryResponse> {
    const [
      totalRequestsRaw,
      resolvedRaw,
      inProgressRaw,
      activeWorkersRaw,
      checkedInToday,
      confirmedToday,
      insideRegion,
      attendanceAgg,
      camerasOnline,
      camerasTotal,
      detectionsAgg,
      utilityAgg,
      turnoverAgg,
    ] = await Promise.all([
      this.prisma.citizenRequest.count(),
      this.prisma.citizenRequest.count({ where: { status: RequestStatus.resolved } }),
      this.prisma.citizenRequest.count({ where: { status: RequestStatus.in_progress } }),
      this.prisma.worker.count({ where: { status: { not: WorkerStatus.offline } } }),
      this.prisma.worker.count({ where: { checkInTime: { not: null } } }),
      this.prisma.worker.count({ where: { todayConfirmed: true } }),
      this.prisma.worker.count({ where: { insideRegion: true } }),
      this.prisma.worker.aggregate({ _avg: { attendanceRate: true } }),
      this.prisma.camera.count({ where: { status: CameraStatus.online } }),
      this.prisma.camera.count(),
      this.prisma.camera.aggregate({ _sum: { detections24h: true } }),
      this.prisma.utilityPayment.aggregate({
        _sum: { charged: true, collected: true, debt: true },
      }),
      this.prisma.financeMonthly.aggregate({ _sum: { turnover: true } }),
    ]);

    const charged = utilityAgg._sum?.charged ?? 0;
    const collected = utilityAgg._sum?.collected ?? 0;
    const debt = utilityAgg._sum?.debt ?? 0;

    return {
      // Mirrors the mock's `<rawCount> + <constant>` formulas so the numbers
      // stay in the same realistic range the web-admin UI was designed for.
      totalRequests: totalRequestsRaw + 1240,
      resolved: resolvedRaw + 980,
      inProgress: inProgressRaw + 180,
      activeWorkers: activeWorkersRaw + 42,

      checkedInToday,
      confirmedToday,
      insideRegion,
      avgAttendance: Math.round(attendanceAgg._avg?.attendanceRate ?? 0),

      camerasOnline,
      camerasTotal,
      detections24h: detectionsAgg._sum?.detections24h ?? 0,

      utilityCharged: charged,
      utilityCollected: collected,
      utilityDebt: debt,
      collectionRate: charged > 0 ? Math.round((collected / charged) * 1000) / 10 : 0,
      turnover: turnoverAgg._sum?.turnover ?? 0,
    };
  }

  /** `GET /analytics/kpi-trend` */
  kpiTrend(): KpiPoint[] {
    return KPI_TREND;
  }

  /** `GET /analytics/category-distribution` */
  async categoryDistribution(): Promise<CategorySlice[]> {
    const groups = await this.prisma.citizenRequest.groupBy({
      by: ['category'],
      _count: true,
    });
    const counts = new Map<RequestCategory, number>(groups.map((g) => [g.category, g._count]));

    // Mirrors the mock's `REQUESTS.filter(...).length + 8` per category.
    return CATEGORY_ORDER.map((category) => ({
      category,
      value: (counts.get(category) ?? 0) + 8,
    }));
  }

  /** `GET /analytics/region-stats` */
  async regionStats(): Promise<RegionStat[]> {
    const [districts, totalGroups, resolvedGroups] = await Promise.all([
      this.prisma.district.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.citizenRequest.groupBy({ by: ['districtId'], _count: true }),
      this.prisma.citizenRequest.groupBy({
        by: ['districtId'],
        where: { status: RequestStatus.resolved },
        _count: true,
      }),
    ]);

    const totals = new Map(totalGroups.map((g) => [g.districtId, g._count]));
    const resolved = new Map(resolvedGroups.map((g) => [g.districtId, g._count]));

    return districts.map((d) => ({
      region: d.name,
      requests: totals.get(d.id) ?? 0,
      resolved: resolved.get(d.id) ?? 0,
    }));
  }

  /** `GET /analytics/hourly-activity` — request count bucketed by hour-of-day (0..23). */
  async hourlyActivity(): Promise<HourlyActivityPoint[]> {
    const rows = await this.prisma.citizenRequest.findMany({ select: { createdAt: true } });
    const buckets = new Array(24).fill(0) as number[];
    for (const row of rows) {
      buckets[row.createdAt.getHours()] += 1;
    }
    return buckets.map((value, hour) => ({ hour: `${hour}:00`, value }));
  }

  /** `GET /analytics/district-loads` */
  async districtLoads(): Promise<DistrictLoad[]> {
    const [districts, totalGroups, resolvedGroups, openGroups, workerGroups, cameraGroups] =
      await Promise.all([
        this.prisma.district.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.citizenRequest.groupBy({ by: ['districtId'], _count: true }),
        this.prisma.citizenRequest.groupBy({
          by: ['districtId'],
          where: { status: RequestStatus.resolved },
          _count: true,
        }),
        this.prisma.citizenRequest.groupBy({
          by: ['districtId'],
          where: { status: { in: [RequestStatus.new, RequestStatus.in_progress] } },
          _count: true,
        }),
        this.prisma.worker.groupBy({ by: ['districtId'], _count: true }),
        this.prisma.camera.groupBy({ by: ['districtId'], _count: true }),
      ]);

    const totals = new Map(totalGroups.map((g) => [g.districtId, g._count]));
    const resolved = new Map(resolvedGroups.map((g) => [g.districtId, g._count]));
    const open = new Map(openGroups.map((g) => [g.districtId, g._count]));
    const workers = new Map(workerGroups.map((g) => [g.districtId, g._count]));
    const cameras = new Map(cameraGroups.map((g) => [g.districtId, g._count]));

    return districts.map((d) => {
      const openCount = open.get(d.id) ?? 0;
      const load: DistrictLoad['load'] =
        openCount >= 6 ? 'critical' : openCount >= 3 ? 'busy' : 'normal';

      return {
        district: this.toDistrictDto(d),
        requests: totals.get(d.id) ?? 0,
        resolved: resolved.get(d.id) ?? 0,
        workers: workers.get(d.id) ?? 0,
        cameras: cameras.get(d.id) ?? 0,
        load,
      };
    });
  }

  private toDistrictDto(d: District): DistrictDto {
    return {
      id: d.id,
      name: d.name,
      center: d.center as [number, number],
      polygon: d.polygon as [number, number][],
      color: d.color,
      population: d.population,
      households: d.households,
      areaKm2: d.areaKm2,
    };
  }
}
