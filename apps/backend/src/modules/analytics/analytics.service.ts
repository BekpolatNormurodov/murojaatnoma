import { Injectable } from '@nestjs/common';
import { CameraStatus, District, RequestStatus, WorkerStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DistrictDto,
  DistrictLoad,
  HourlyActivityPoint,
  RegionStat,
  SummaryResponse,
} from './analytics.types';

/**
 * Legacy dashboard + analytics ("hisobot") aggregations for the web-admin
 * panel, all straight from the DB (no padding constants). The dashboard itself
 * now reads `OverviewService` (`GET /analytics/overview`); the trend line and
 * category split are served from there too so every screen agrees.
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
      totalRequests: totalRequestsRaw,
      resolved: resolvedRaw,
      inProgress: inProgressRaw,
      activeWorkers: activeWorkersRaw,

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
