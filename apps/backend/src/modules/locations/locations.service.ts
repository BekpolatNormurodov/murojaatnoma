import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocationSource, Prisma } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { distanceInMeters } from '../../common/geo/geo.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { TrackQueryDto } from './dto/track-query.dto';

interface OfficeGeofence {
  lat: number;
  lng: number;
  radiusM: number;
}

interface EmployeeIngestInfo {
  id: string;
  officeLat: number | null;
  officeLng: number | null;
  officeRadiusM: number | null;
  lastLocationAt: Date | null;
}

/** Derived, storage-ready fields for one GPS report. */
interface DerivedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery: number | null;
  source: LocationSource;
  mahallaCode: string | null;
  mahallaName: string | null;
  insideDistrict: boolean;
  insideOffice: boolean;
  distanceToOfficeM: number;
  recordedAt: Date;
}

export interface IngestResult {
  id: string;
  recordedAt: Date;
  mahalla: { code: string; name: string } | null;
  insideDistrict: boolean;
  insideOffice: boolean;
  distanceToOfficeM: number;
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get staleMinutes(): number {
    return this.config.get('location', { infer: true }).staleMinutes;
  }

  private globalOffice(): OfficeGeofence {
    const att = this.config.get('attendance', { infer: true });
    return { lat: att.officeLatitude, lng: att.officeLongitude, radiusM: att.geofenceRadiusM };
  }

  private resolveOffice(emp: EmployeeIngestInfo): OfficeGeofence {
    const g = this.globalOffice();
    return {
      lat: emp.officeLat ?? g.lat,
      lng: emp.officeLng ?? g.lng,
      radiusM: emp.officeRadiusM ?? g.radiusM,
    };
  }

  private async getEmployeeForIngest(employeeId: string): Promise<EmployeeIngestInfo> {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        officeLat: true,
        officeLng: true,
        officeRadiusM: true,
        lastLocationAt: true,
      },
    });
    if (!emp) {
      throw new NotFoundException('Employee not found');
    }
    return emp;
  }

  private async derive(
    office: OfficeGeofence,
    dto: CreateLocationDto,
    fallbackSource: LocationSource,
  ): Promise<DerivedLocation> {
    const locate = await this.zones.locate(dto.latitude, dto.longitude);
    const distanceToOfficeM = Math.round(
      distanceInMeters(dto.latitude, dto.longitude, office.lat, office.lng),
    );
    return {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      battery: dto.battery ?? null,
      source: dto.source ?? fallbackSource,
      mahallaCode: locate.mahalla?.code ?? null,
      mahallaName: locate.mahalla?.nameUzLat ?? null,
      insideDistrict: locate.insideDistrict,
      insideOffice: distanceToOfficeM <= office.radiusM,
      distanceToOfficeM,
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
    };
  }

  private async writeDenormalized(employeeId: string, d: DerivedLocation): Promise<void> {
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        lastLat: d.latitude,
        lastLng: d.longitude,
        lastAccuracyM: d.accuracy,
        lastLocationAt: d.recordedAt,
        lastMahallaCode: d.mahallaCode,
        lastMahallaName: d.mahallaName,
        lastInsideDistrict: d.insideDistrict,
        lastInsideOffice: d.insideOffice,
        // A fresh report clears any active "no location" alert episode.
        staleAlertedAt: null,
      },
    });
  }

  private toIngestResult(id: string, d: DerivedLocation): IngestResult {
    return {
      id,
      recordedAt: d.recordedAt,
      mahalla: d.mahallaCode ? { code: d.mahallaCode, name: d.mahallaName ?? '' } : null,
      insideDistrict: d.insideDistrict,
      insideOffice: d.insideOffice,
      distanceToOfficeM: d.distanceToOfficeM,
    };
  }

  /** Ingest a single live GPS report from an employee. */
  async ingest(employeeId: string, dto: CreateLocationDto): Promise<IngestResult> {
    const emp = await this.getEmployeeForIngest(employeeId);
    const office = this.resolveOffice(emp);
    const d = await this.derive(office, dto, LocationSource.FOREGROUND);

    const created = await this.prisma.employeeLocation.create({
      data: { employeeId, ...d },
    });
    if (!emp.lastLocationAt || d.recordedAt >= emp.lastLocationAt) {
      await this.writeDenormalized(employeeId, d);
    }
    return this.toIngestResult(created.id, d);
  }

  /** Ingest a batch flushed from the mobile offline queue (oldest-first). */
  async ingestBatch(
    employeeId: string,
    items: CreateLocationDto[],
  ): Promise<{ accepted: number; latest: IngestResult | null }> {
    const emp = await this.getEmployeeForIngest(employeeId);
    const office = this.resolveOffice(emp);
    const derived = await Promise.all(
      items.map((it) => this.derive(office, it, LocationSource.BACKGROUND)),
    );

    await this.prisma.employeeLocation.createMany({
      data: derived.map((d) => ({ employeeId, ...d })),
    });

    let newest = derived[0];
    for (const d of derived) {
      if (d.recordedAt > newest.recordedAt) {
        newest = d;
      }
    }

    let latest: IngestResult | null = null;
    if (!emp.lastLocationAt || newest.recordedAt >= emp.lastLocationAt) {
      await this.writeDenormalized(employeeId, newest);
      latest = this.toIngestResult('batch', newest);
    }
    return { accepted: derived.length, latest };
  }

  /** An employee's own last known position. */
  async getMyLatest(employeeId: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        lastLat: true,
        lastLng: true,
        lastAccuracyM: true,
        lastLocationAt: true,
        lastMahallaCode: true,
        lastMahallaName: true,
        lastInsideDistrict: true,
        lastInsideOffice: true,
      },
    });
    if (!e) {
      throw new NotFoundException('Employee not found');
    }
    return {
      latitude: e.lastLat,
      longitude: e.lastLng,
      accuracy: e.lastAccuracyM,
      recordedAt: e.lastLocationAt,
      mahallaCode: e.lastMahallaCode,
      mahallaName: e.lastMahallaName,
      insideDistrict: e.lastInsideDistrict,
      insideOffice: e.lastInsideOffice,
    };
  }

  /** Latest position of every active employee — powers the admin live map. */
  async getLatestForAll() {
    const staleMinutes = this.staleMinutes;
    const now = Date.now();
    const emps = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        position: true,
        avatarUrl: true,
        district: true,
        lastLat: true,
        lastLng: true,
        lastAccuracyM: true,
        lastLocationAt: true,
        lastMahallaCode: true,
        lastMahallaName: true,
        lastInsideDistrict: true,
        lastInsideOffice: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return emps.map((e) => {
      const ageMinutes = e.lastLocationAt
        ? Math.floor((now - e.lastLocationAt.getTime()) / 60_000)
        : null;
      return {
        employeeId: e.id,
        fullName: e.fullName,
        position: e.position,
        avatarUrl: e.avatarUrl,
        district: e.district,
        latitude: e.lastLat,
        longitude: e.lastLng,
        accuracy: e.lastAccuracyM,
        mahallaCode: e.lastMahallaCode,
        mahallaName: e.lastMahallaName,
        insideDistrict: e.lastInsideDistrict,
        insideOffice: e.lastInsideOffice,
        lastLocationAt: e.lastLocationAt,
        ageMinutes,
        hasLocation: e.lastLat !== null && e.lastLng !== null,
        isStale: ageMinutes === null || ageMinutes > staleMinutes,
      };
    });
  }

  /** Location history (track polyline) for one employee. */
  async getTrack(employeeId: string, query: TrackQueryDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, fullName: true, position: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const recordedAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      recordedAt.gte = new Date(query.from);
    }
    if (query.to) {
      recordedAt.lte = new Date(query.to);
    }

    const points = await this.prisma.employeeLocation.findMany({
      where: {
        employeeId,
        ...(query.from || query.to ? { recordedAt } : {}),
      },
      orderBy: { recordedAt: 'asc' },
      take: query.limit ?? 500,
      select: {
        latitude: true,
        longitude: true,
        accuracy: true,
        speed: true,
        insideOffice: true,
        insideDistrict: true,
        mahallaName: true,
        recordedAt: true,
      },
    });

    return { employee, count: points.length, points };
  }

  /** Active employees with no location for > staleMinutes (or never) — admin alerts. */
  async getAlerts() {
    const staleMinutes = this.staleMinutes;
    const now = Date.now();
    const threshold = new Date(now - staleMinutes * 60_000);
    const emps = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        OR: [{ lastLocationAt: { lt: threshold } }, { lastLocationAt: null }],
      },
      select: {
        id: true,
        fullName: true,
        position: true,
        phone: true,
        avatarUrl: true,
        lastLocationAt: true,
        lastMahallaName: true,
        staleAlertedAt: true,
      },
      orderBy: [{ lastLocationAt: { sort: 'asc', nulls: 'first' } }],
    });

    return emps.map((e) => ({
      employeeId: e.id,
      fullName: e.fullName,
      position: e.position,
      phone: e.phone,
      avatarUrl: e.avatarUrl,
      lastLocationAt: e.lastLocationAt,
      lastMahallaName: e.lastMahallaName,
      reason: e.lastLocationAt ? ('stale' as const) : ('never' as const),
      ageMinutes: e.lastLocationAt
        ? Math.floor((now - e.lastLocationAt.getTime()) / 60_000)
        : null,
      alerted: e.staleAlertedAt !== null,
    }));
  }

  /** Headline counters for the admin location dashboard. */
  async getStats() {
    const staleMinutes = this.staleMinutes;
    const threshold = new Date(Date.now() - staleMinutes * 60_000);
    const [totalActive, reportingNow, insideOffice, stale] = await Promise.all([
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.employee.count({
        where: { isActive: true, lastLocationAt: { gte: threshold } },
      }),
      this.prisma.employee.count({
        where: { isActive: true, lastInsideOffice: true, lastLocationAt: { gte: threshold } },
      }),
      this.prisma.employee.count({
        where: {
          isActive: true,
          OR: [{ lastLocationAt: { lt: threshold } }, { lastLocationAt: null }],
        },
      }),
    ]);
    return { totalActive, reportingNow, insideOffice, stale, staleMinutes };
  }
}
