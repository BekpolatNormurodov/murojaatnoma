import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocationSource, Prisma } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { distanceInMeters } from '../../common/geo/geo.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ZonesService, zoneToleranceM } from '../zones/zones.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { TrackQueryDto } from './dto/track-query.dto';


/** A pause this long between two fixes is a break in the route (GPS off / app closed). */
export const TRACK_GAP_MS = 15 * 60_000;
/** Rows read for one track window at most (a full day at one fix / 30 s is ~2 900). */
const TRACK_SCAN_CAP = 20_000;

/**
 * Thins a chronological track to about `limit` points for drawing, always
 * keeping the first and last fix and both ends of every gap, so the route's
 * start, live end and its breaks survive. Returns the input when it fits.
 */
export function downsampleTrack<T extends { recordedAt: Date }>(points: T[], limit: number): T[] {
  if (points.length <= limit) return points;
  const keep = new Set<number>([0, points.length - 1]);
  for (let i = 1; i < points.length; i++) {
    if (points[i].recordedAt.getTime() - points[i - 1].recordedAt.getTime() >= TRACK_GAP_MS) {
      keep.add(i - 1);
      keep.add(i);
    }
  }
  const room = Math.max(limit - keep.size, 1);
  const step = Math.ceil(points.length / room);
  for (let i = 0; i < points.length; i += step) keep.add(i);
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}

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
  assignedMahallaCodes: string[];
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
  insideAssignedZone: boolean;
  distanceToOfficeM: number;
  recordedAt: Date;
}

export interface IngestResult {
  id: string;
  recordedAt: Date;
  mahalla: { code: string; name: string } | null;
  insideDistrict: boolean;
  insideOffice: boolean;
  insideAssignedZone: boolean;
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
        assignedMahallaCodes: true,
        lastLocationAt: true,
      },
    });
    if (!emp) {
      throw new NotFoundException('Employee not found');
    }
    return emp;
  }

  /**
   * Territory oversight: is this report inside the employee's assigned zone?
   * Being at the office always counts (staff at their desk are never "out of
   * territory"). When no mahallas are assigned, the whole district counts
   * (falls back to `insideDistrict`); otherwise the resolved mahalla must be
   * one of the assigned ones.
   */
  private computeInsideAssignedZone(
    assignedMahallaCodes: string[],
    mahallaCode: string | null,
    insideDistrict: boolean,
    insideOffice: boolean,
  ): boolean {
    if (insideOffice) {
      return true;
    }
    if (assignedMahallaCodes.length === 0) {
      return insideDistrict;
    }
    return mahallaCode != null && assignedMahallaCodes.includes(mahallaCode);
  }

  private async derive(
    office: OfficeGeofence,
    assignedMahallaCodes: string[],
    dto: CreateLocationDto,
    fallbackSource: LocationSource,
  ): Promise<DerivedLocation> {
    const locate = await this.zones.locate(dto.latitude, dto.longitude);
    const distanceToOfficeM = Math.round(
      distanceInMeters(dto.latitude, dto.longitude, office.lat, office.lng),
    );
    const mahallaCode = locate.mahalla?.code ?? null;
    const insideOffice = distanceToOfficeM <= office.radiusM;
    let insideAssignedZone = this.computeInsideAssignedZone(
      assignedMahallaCodes,
      mahallaCode,
      locate.insideDistrict,
      insideOffice,
    );
    // Strict point-in-polygon said "outside" — re-check with boundary
    // tolerance (GPS jitter). Only for the assigned-mahalla case; the
    // whole-district fallback is huge, so boundary slack there is pointless.
    if (
      !insideAssignedZone &&
      !insideOffice &&
      assignedMahallaCodes.length > 0
    ) {
      const toleranceM = zoneToleranceM(dto.accuracy);
      insideAssignedZone = await this.zones.isWithinToleranceOfMahallas(
        dto.latitude,
        dto.longitude,
        assignedMahallaCodes,
        toleranceM,
      );
    }
    return {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      battery: dto.battery ?? null,
      source: dto.source ?? fallbackSource,
      mahallaCode,
      mahallaName: locate.mahalla?.nameUzLat ?? null,
      insideDistrict: locate.insideDistrict,
      insideOffice,
      insideAssignedZone,
      distanceToOfficeM,
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
    };
  }

  /**
   * Cleans a list of mahalla codes coming from the admin: trimmed, de-duplicated
   * and checked against the real mahallas — an unknown code would silently make
   * the employee "outside" forever, so it is refused instead.
   */
  async normalizeMahallaCodes(codes: string[]): Promise<string[]> {
    const clean = [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))];
    if (clean.length === 0) return [];
    const known = new Set((await this.zones.listZones('MAHALLA')).map((z) => z.code));
    const unknown = clean.filter((c) => !known.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(`Bunday mahalla yo'q: ${unknown.slice(0, 5).join(', ')}`);
    }
    return clean;
  }

  /**
   * Call after an employee's territory (assigned mahallas) or office point
   * changed. Re-derives, with the NEW rules:
   *  - the denormalized "latest location" flags, so the admin list and live
   *    map flip to Hududda/Tashqarida immediately instead of waiting for the
   *    next GPS report (which may be hours away);
   *  - every fix recorded TODAY, so today's "hududda necha soat" is counted
   *    against the territory the admin has just set. Earlier days keep the
   *    territory that was in force on those days.
   * Uses the same office-first + boundary-tolerance rule as live ingest.
   */
  async reevaluateTerritory(employeeId: string): Promise<{ insideAssignedZone: boolean | null; fixesUpdated: number }> {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        officeLat: true,
        officeLng: true,
        officeRadiusM: true,
        assignedMahallaCodes: true,
        lastLocationAt: true,
        lastLat: true,
        lastLng: true,
        lastAccuracyM: true,
        lastMahallaCode: true,
        lastInsideDistrict: true,
      },
    });
    if (!emp) {
      throw new NotFoundException('Employee not found');
    }
    const office = this.resolveOffice(emp);
    const codes = emp.assignedMahallaCodes;

    const judge = async (p: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      mahallaCode: string | null;
      insideDistrict: boolean;
    }): Promise<{ insideOffice: boolean; insideAssignedZone: boolean; distanceToOfficeM: number }> => {
      const distanceToOfficeM = Math.round(distanceInMeters(p.latitude, p.longitude, office.lat, office.lng));
      const insideOffice = distanceToOfficeM <= office.radiusM;
      let insideAssignedZone = this.computeInsideAssignedZone(codes, p.mahallaCode, p.insideDistrict, insideOffice);
      if (!insideAssignedZone && !insideOffice && codes.length > 0) {
        insideAssignedZone = await this.zones.isWithinToleranceOfMahallas(
          p.latitude,
          p.longitude,
          codes,
          zoneToleranceM(p.accuracy),
        );
      }
      return { insideOffice, insideAssignedZone, distanceToOfficeM };
    };

    let latest: boolean | null = null;
    if (emp.lastLat != null && emp.lastLng != null) {
      const j = await judge({
        latitude: emp.lastLat,
        longitude: emp.lastLng,
        accuracy: emp.lastAccuracyM,
        mahallaCode: emp.lastMahallaCode,
        insideDistrict: emp.lastInsideDistrict,
      });
      latest = j.insideAssignedZone;
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { lastInsideOffice: j.insideOffice, lastInsideAssignedZone: j.insideAssignedZone },
      });
    } else if (emp.lastLocationAt == null) {
      // Never reported: not "outside" — the list shows "Lokatsiya yo'q".
      await this.prisma.employee.update({ where: { id: employeeId }, data: { lastInsideAssignedZone: true } });
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const fixes = await this.prisma.employeeLocation.findMany({
      where: { employeeId, recordedAt: { gte: dayStart } },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        mahallaCode: true,
        insideDistrict: true,
        insideOffice: true,
        insideAssignedZone: true,
        distanceToOfficeM: true,
      },
    });
    const ids: string[] = [];
    const zoneFlags: boolean[] = [];
    const officeFlags: boolean[] = [];
    const distances: number[] = [];
    for (const f of fixes) {
      const j = await judge(f);
      if (
        j.insideAssignedZone !== f.insideAssignedZone ||
        j.insideOffice !== f.insideOffice ||
        j.distanceToOfficeM !== f.distanceToOfficeM
      ) {
        ids.push(f.id);
        zoneFlags.push(j.insideAssignedZone);
        officeFlags.push(j.insideOffice);
        distances.push(j.distanceToOfficeM);
      }
    }
    if (ids.length > 0) {
      await this.prisma.$executeRaw`
        UPDATE employee_locations AS l
        SET "insideAssignedZone" = v.zone, "insideOffice" = v.office, "distanceToOfficeM" = v.dist
        FROM unnest(${ids}::text[], ${zoneFlags}::boolean[], ${officeFlags}::boolean[], ${distances}::float8[])
          AS v(id, zone, office, dist)
        WHERE l.id = v.id`;
    }
    return { insideAssignedZone: latest, fixesUpdated: ids.length };
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
        lastInsideAssignedZone: d.insideAssignedZone,
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
      insideAssignedZone: d.insideAssignedZone,
      distanceToOfficeM: d.distanceToOfficeM,
    };
  }

  /** Ingest a single live GPS report from an employee. */
  async ingest(employeeId: string, dto: CreateLocationDto): Promise<IngestResult> {
    const emp = await this.getEmployeeForIngest(employeeId);
    const office = this.resolveOffice(emp);
    const d = await this.derive(office, emp.assignedMahallaCodes, dto, LocationSource.FOREGROUND);

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
      items.map((it) => this.derive(office, emp.assignedMahallaCodes, it, LocationSource.BACKGROUND)),
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
        lastInsideAssignedZone: true,
        assignedMahallaCodes: true,
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
      insideAssignedZone: e.lastInsideAssignedZone,
      // The mahalla codes this employee is assigned to patrol — the worker-app
      // map draws THESE polygons as the "ish hududi" (not the office circle).
      assignedMahallaCodes: e.assignedMahallaCodes,
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
        phone: true,
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
        lastInsideAssignedZone: true,
        assignedMahallaCodes: true,
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
        phone: e.phone,
        avatarUrl: e.avatarUrl,
        district: e.district,
        latitude: e.lastLat,
        longitude: e.lastLng,
        accuracy: e.lastAccuracyM,
        mahallaCode: e.lastMahallaCode,
        mahallaName: e.lastMahallaName,
        insideDistrict: e.lastInsideDistrict,
        insideOffice: e.lastInsideOffice,
        insideAssignedZone: e.lastInsideAssignedZone,
        assignedMahallaCodes: e.assignedMahallaCodes,
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

    const limit = query.limit ?? 500;
    const windowed = !!(query.from || query.to);
    const rows = await this.prisma.employeeLocation.findMany({
      where: {
        employeeId,
        ...(windowed ? { recordedAt } : {}),
      },
      // Newest first, so any cap keeps the most RECENT movement. (Ascending +
      // take used to return only the first 500 fixes of the day — on a busy
      // day the afternoon was missing and the "live" end of the route was
      // hours old.) A window is read whole and thinned below instead.
      orderBy: { recordedAt: 'desc' },
      take: windowed ? TRACK_SCAN_CAP : limit,
      select: {
        latitude: true,
        longitude: true,
        accuracy: true,
        speed: true,
        battery: true,
        insideOffice: true,
        insideDistrict: true,
        insideAssignedZone: true,
        distanceToOfficeM: true,
        mahallaName: true,
        recordedAt: true,
      },
    });
    rows.reverse();
    const points = downsampleTrack(rows, limit);

    return { employee, count: points.length, total: rows.length, points };
  }

  /**
   * Admin alerts = employees who WERE reporting and then went stale
   * (no location for > staleMinutes). Employees who have NEVER reported
   * (lastLocationAt = null — e.g. the mobile app isn't installed yet) are
   * deliberately EXCLUDED: that's a "not started" state, not an anomaly, so it
   * doesn't belong in the alert feed (the live map / Nazorat already show them
   * as "Lokatsiya yo'q"). Prevents a wall of false alerts for freshly-seeded staff.
   */
  async getAlerts() {
    const staleMinutes = this.staleMinutes;
    const now = Date.now();
    const threshold = new Date(now - staleMinutes * 60_000);
    const emps = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        lastLocationAt: { lt: threshold },
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
    const [totalActive, reportingNow, insideOffice, stale, neverReported] = await Promise.all([
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.employee.count({
        where: { isActive: true, lastLocationAt: { gte: threshold } },
      }),
      this.prisma.employee.count({
        where: { isActive: true, lastInsideOffice: true, lastLocationAt: { gte: threshold } },
      }),
      // Stale = was reporting, now silent (an anomaly). Excludes never-reported.
      this.prisma.employee.count({
        where: { isActive: true, lastLocationAt: { lt: threshold } },
      }),
      // Never reported = mobile app not installed / not started yet (info, not an alert).
      this.prisma.employee.count({
        where: { isActive: true, lastLocationAt: null },
      }),
    ]);
    return { totalActive, reportingNow, insideOffice, stale, neverReported, staleMinutes };
  }
}
