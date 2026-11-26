import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationSource, NotificationType, Prisma } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { RT_EVENTS, TerritoryChangedEvent } from '../../common/events/realtime-events';
import { distanceInMeters } from '../../common/geo/geo.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationCenter } from '../notifications/notification-center.service';
import { parseTimeOnDate } from '../attendance/utils/date.util';
import { ZonesService, zoneToleranceM } from '../zones/zones.service';
import { coveredMs } from './coverage';
import { CreateLocationDto } from './dto/create-location.dto';
import { DeviceStatusDto } from './dto/device-status.dto';
import { TrackQueryDto } from './dto/track-query.dto';


/** A pause this long between two fixes is a break in the route (GPS off / app closed). */
export const TRACK_GAP_MS = 15 * 60_000;
/** Rows read for one track window at most (a full day at one fix / 30 s is ~2 900). */
const TRACK_SCAN_CAP = 20_000;
/** A device clock further ahead than this is wrong: the fix is stamped with server time. */
export const MAX_FUTURE_SKEW_MS = 5 * 60_000;
/** Buffered fixes older than this are acknowledged but not stored. */
export const MAX_FIX_AGE_MS = 8 * 86_400_000;
/** Mahalla names listed in the "territory changed" message before "va yana N ta". */
const NOTICE_MAHALLA_LIMIT = 10;

function startOfLocalDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** When a report was taken: the device time, unless missing, unreadable or in the future. */
function fixTime(raw: string | undefined, now: Date): Date {
  if (!raw) return now;
  const at = new Date(raw);
  return at.getTime() <= now.getTime() + MAX_FUTURE_SKEW_MS ? at : now;
}

const isTooOld = (at: Date, now: Date): boolean =>
  now.getTime() - at.getTime() > MAX_FIX_AGE_MS;

/**
 * May a fix taken at `at` become the "latest location"? Yes when it is not older
 * than the stored one — or the stored time is impossible (a future time written
 * by a wrong device clock), which would otherwise freeze the employee forever.
 */
function supersedesLatest(at: Date, lastAt: Date | null, now: Date): boolean {
  return !lastAt || at >= lastAt || lastAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS;
}

/** Same mahallas, whatever the order or repetition. */
function sameCodes(a: string[], b: string[]): boolean {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((c) => y.has(c));
}

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

/** What the territory rule needs to know about one position. */
interface TerritoryPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mahallaCode: string | null;
  insideDistrict: boolean;
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
  hadTerritory: boolean;
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
    private readonly notifications: NotificationCenter,
    private readonly events: EventEmitter2,
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
   * Territory oversight: is this position inside the employee's assigned
   * territory — one of the assigned mahallas, or within GPS tolerance of one?
   * With nothing assigned there is no territory, so the answer is always no.
   * The office is NOT territory — it is reported separately as `insideOffice`.
   */
  private async isInTerritory(codes: string[], p: TerritoryPoint): Promise<boolean> {
    if (codes.length === 0) {
      return false;
    }
    if (p.mahallaCode != null && codes.includes(p.mahallaCode)) {
      return true;
    }
    // Strict point-in-polygon said "outside" — re-check with boundary tolerance
    // (GPS jitter).
    return this.zones.isWithinToleranceOfMahallas(
      p.latitude,
      p.longitude,
      codes,
      zoneToleranceM(p.accuracy),
    );
  }

  private async derive(
    office: OfficeGeofence,
    assignedMahallaCodes: string[],
    dto: CreateLocationDto,
    fallbackSource: LocationSource,
    recordedAt: Date,
  ): Promise<DerivedLocation> {
    const locate = await this.zones.locate(dto.latitude, dto.longitude);
    const distanceToOfficeM = Math.round(
      distanceInMeters(dto.latitude, dto.longitude, office.lat, office.lng),
    );
    const mahallaCode = locate.mahalla?.code ?? null;
    const accuracy = dto.accuracy ?? null;
    const insideAssignedZone = await this.isInTerritory(assignedMahallaCodes, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy,
      mahallaCode,
      insideDistrict: locate.insideDistrict,
    });
    return {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      battery: dto.battery ?? null,
      source: dto.source ?? fallbackSource,
      mahallaCode,
      mahallaName: locate.mahalla?.nameUzLat ?? null,
      insideDistrict: locate.insideDistrict,
      insideOffice: distanceToOfficeM <= office.radiusM,
      insideAssignedZone,
      hadTerritory: assignedMahallaCodes.length > 0,
      distanceToOfficeM,
      recordedAt,
    };
  }

  /**
   * Which territory judges a fix taken at a given time: the current one, unless
   * the assignment was changed on a LATER day — then the one in force before the
   * earliest such change (offline fixes flushed late). A change made today stays
   * retroactive for today's fixes, as in `reevaluateTerritory`.
   */
  private async territoryResolver(
    employeeId: string,
    current: string[],
    times: Date[],
    now: Date,
  ): Promise<(at: Date) => string[]> {
    const oldest = new Date(Math.min(...times.map((t) => t.getTime())));
    if (oldest >= startOfLocalDay(now)) {
      return () => current;
    }
    const nextDay = startOfLocalDay(oldest);
    nextDay.setDate(nextDay.getDate() + 1);
    const changes = await this.prisma.territoryChange.findMany({
      where: { employeeId, changedAt: { gte: nextDay } },
      orderBy: { changedAt: 'asc' },
      select: { previousCodes: true, changedAt: true },
    });
    return (at) =>
      changes.find((c) => startOfLocalDay(c.changedAt) > at)?.previousCodes ?? current;
  }

  /**
   * The "latest location" flags always describe the CURRENT territory, even when
   * the stored fix was judged by an earlier one.
   */
  private async underCurrentTerritory(
    d: DerivedLocation,
    judgedBy: string[],
    current: string[],
  ): Promise<DerivedLocation> {
    if (judgedBy === current) return d;
    return { ...d, insideAssignedZone: await this.isInTerritory(current, d) };
  }

  /** Mahalla codes with their names, in the given order. */
  private async mahallaRefs(codes: string[]): Promise<{ code: string; name: string }[]> {
    if (codes.length === 0) return [];
    const names = new Map(
      (await this.zones.listZones('MAHALLA')).map((z) => [z.code, z.nameUzLat]),
    );
    return codes.map((code) => ({ code, name: names.get(code) ?? code }));
  }

  /**
   * Call after an employee's assigned mahallas were saved (the ONE path for
   * every admin screen). When the set really changed: remembers the previous
   * territory (late offline fixes are judged by it) and tells the employee —
   * a live socket event, an inbox row and a push.
   *
   * @returns whether anything changed.
   */
  async territoryChanged(
    employeeId: string,
    previousCodes: string[],
    codes: string[],
  ): Promise<boolean> {
    if (sameCodes(previousCodes, codes)) return false;
    const changedAt = new Date();
    await this.prisma.territoryChange.create({
      data: { employeeId, previousCodes, codes, changedAt },
    });

    const assignedMahallas = await this.mahallaRefs(codes);
    const event: TerritoryChangedEvent = {
      employeeId,
      assignedMahallas,
      changedAt: changedAt.toISOString(),
    };
    this.events.emit(RT_EVENTS.territoryChanged, event);

    const listed = assignedMahallas.slice(0, NOTICE_MAHALLA_LIMIT).map((m) => m.name);
    const more = assignedMahallas.length - listed.length;
    const body =
      assignedMahallas.length === 0
        ? 'Sizga biriktirilgan mahallalar olib tashlandi.'
        : `Biriktirilgan mahallalar: ${listed.join(', ')}${more > 0 ? ` va yana ${more} ta` : ''}`;
    await this.notifications.employee(
      employeeId,
      "Hududingiz o'zgartirildi",
      body,
      { type: 'LOCATION', event: 'territory_changed' },
      NotificationType.LOCATION,
    );
    return true;
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
   * Uses the same territory (+ boundary tolerance) and office rules as live ingest.
   */
  async reevaluateTerritory(employeeId: string): Promise<{
    /** Flags of the last known position; null when there is none. */
    insideAssignedZone: boolean | null;
    insideOffice: boolean | null;
    fixesUpdated: number;
  }> {
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

    const judge = async (
      p: TerritoryPoint,
    ): Promise<{
      insideOffice: boolean;
      insideAssignedZone: boolean;
      distanceToOfficeM: number;
    }> => {
      const distanceToOfficeM = Math.round(distanceInMeters(p.latitude, p.longitude, office.lat, office.lng));
      const insideOffice = distanceToOfficeM <= office.radiusM;
      const insideAssignedZone = await this.isInTerritory(codes, p);
      return { insideOffice, insideAssignedZone, distanceToOfficeM };
    };

    let latest: boolean | null = null;
    let latestOffice: boolean | null = null;
    if (emp.lastLat != null && emp.lastLng != null) {
      const j = await judge({
        latitude: emp.lastLat,
        longitude: emp.lastLng,
        accuracy: emp.lastAccuracyM,
        mahallaCode: emp.lastMahallaCode,
        insideDistrict: emp.lastInsideDistrict,
      });
      latest = j.insideAssignedZone;
      latestOffice = j.insideOffice;
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { lastInsideOffice: j.insideOffice, lastInsideAssignedZone: j.insideAssignedZone },
      });
    } else if (emp.lastLocationAt == null) {
      // Never reported: the list shows "Lokatsiya yo'q". The flag stays true only
      // so that a person who has a territory is not listed as outside it.
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { lastInsideAssignedZone: codes.length > 0 },
      });
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
        hadTerritory: true,
        distanceToOfficeM: true,
      },
    });
    const ids: string[] = [];
    const zoneFlags: boolean[] = [];
    const officeFlags: boolean[] = [];
    const distances: number[] = [];
    const had = codes.length > 0;
    for (const f of fixes) {
      const j = await judge(f);
      if (
        j.insideAssignedZone !== f.insideAssignedZone ||
        had !== f.hadTerritory ||
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
        SET "insideAssignedZone" = v.zone, "insideOffice" = v.office, "distanceToOfficeM" = v.dist,
            "hadTerritory" = ${had}
        FROM unnest(${ids}::text[], ${zoneFlags}::boolean[], ${officeFlags}::boolean[], ${distances}::float8[])
          AS v(id, zone, office, dist)
        WHERE l.id = v.id`;
    }
    return {
      insideAssignedZone: latest,
      insideOffice: latestOffice,
      fixesUpdated: ids.length,
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
    const current = emp.assignedMahallaCodes;
    const now = new Date();
    const recordedAt = fixTime(dto.recordedAt, now);

    // Too old to keep: answered like any report (so the app drops it from its
    // queue) but nothing is stored — `id` is empty.
    if (isTooOld(recordedAt, now)) {
      const dropped = await this.derive(
        office,
        current,
        dto,
        LocationSource.FOREGROUND,
        recordedAt,
      );
      return this.toIngestResult('', dropped);
    }

    const codes = (await this.territoryResolver(employeeId, current, [recordedAt], now))(
      recordedAt,
    );
    const d = await this.derive(
      office,
      codes,
      dto,
      LocationSource.FOREGROUND,
      recordedAt,
    );

    // A retried upload (the answer was lost) must not store the same fix twice.
    if (dto.recordedAt) {
      const [stored] =
        (await this.prisma.employeeLocation.findMany({
          where: { employeeId, recordedAt: d.recordedAt },
          select: { id: true },
          take: 1,
        })) ?? [];
      if (stored) {
        return this.toIngestResult(stored.id, d);
      }
    }

    const created = await this.prisma.employeeLocation.create({
      data: { employeeId, ...d },
    });
    if (supersedesLatest(d.recordedAt, emp.lastLocationAt, now)) {
      await this.writeDenormalized(
        employeeId,
        await this.underCurrentTerritory(d, codes, current),
      );
    }
    return this.toIngestResult(created.id, d);
  }

  /**
   * Drops fixes this employee already has (same device time) and repeats inside
   * the batch itself — the offline queue re-sends a batch whose answer was lost.
   */
  private async withoutStored<T extends { recordedAt: Date }>(
    employeeId: string,
    fixes: T[],
  ): Promise<T[]> {
    const stored =
      (await this.prisma.employeeLocation.findMany({
        where: { employeeId, recordedAt: { in: fixes.map((f) => f.recordedAt) } },
        select: { recordedAt: true },
      })) ?? [];
    const seen = new Set(stored.map((r) => r.recordedAt.getTime()));
    return fixes.filter((f) => {
      const at = f.recordedAt.getTime();
      if (seen.has(at)) return false;
      seen.add(at);
      return true;
    });
  }

  /** Ingest a batch flushed from the mobile offline queue (oldest-first). */
  async ingestBatch(
    employeeId: string,
    items: CreateLocationDto[],
  ): Promise<{ accepted: number; latest: IngestResult | null }> {
    const emp = await this.getEmployeeForIngest(employeeId);
    const office = this.resolveOffice(emp);
    const current = emp.assignedMahallaCodes;
    const now = new Date();
    const kept = items
      .map((dto) => ({ dto, recordedAt: fixTime(dto.recordedAt, now) }))
      .filter((x) => !isTooOld(x.recordedAt, now));
    if (kept.length === 0) {
      return { accepted: 0, latest: null };
    }

    const codesAt = await this.territoryResolver(
      employeeId,
      current,
      kept.map((x) => x.recordedAt),
      now,
    );
    const derived = await Promise.all(
      kept.map((x) =>
        this.derive(
          office,
          codesAt(x.recordedAt),
          x.dto,
          LocationSource.BACKGROUND,
          x.recordedAt,
        ),
      ),
    );

    const fresh = await this.withoutStored(employeeId, derived);
    if (fresh.length > 0) {
      await this.prisma.employeeLocation.createMany({
        data: fresh.map((d) => ({ employeeId, ...d })),
      });
    }

    let newest = derived[0];
    for (const d of derived) {
      if (d.recordedAt > newest.recordedAt) {
        newest = d;
      }
    }

    let latest: IngestResult | null = null;
    if (supersedesLatest(newest.recordedAt, emp.lastLocationAt, now)) {
      const live = await this.underCurrentTerritory(
        newest,
        codesAt(newest.recordedAt),
        current,
      );
      await this.writeDenormalized(employeeId, live);
      latest = this.toIngestResult('batch', live);
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
      insideAssignedZone: e.assignedMahallaCodes.length > 0 && e.lastInsideAssignedZone,
      // The mahalla codes this employee is assigned to patrol — the worker-app
      // map draws THESE polygons as the "ish hududi" (not the office circle).
      assignedMahallaCodes: e.assignedMahallaCodes,
      // Same set with names (empty = nothing assigned).
      assignedMahallas: await this.mahallaRefs(e.assignedMahallaCodes),
    };
  }

  /** Stores the phone's latest self-report; the server clock dates it. */
  async saveDeviceStatus(employeeId: string, dto: DeviceStatusDto): Promise<{ ok: true }> {
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { deviceStatus: { ...dto }, deviceStatusAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Today's reporting coverage of every active employee inside their own
   * working hours (up to now) — "who is really sending location".
   */
  async getCoverage(now = new Date()) {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, workStartTime: true, workEndTime: true },
    });
    const dayStart = parseTimeOnDate(now, '00:00');
    const points = await this.prisma.employeeLocation.findMany({
      where: { recordedAt: { gte: dayStart, lte: now } },
      select: { employeeId: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });
    const byEmployee = new Map<string, number[]>();
    for (const p of points) {
      const list = byEmployee.get(p.employeeId);
      if (list) list.push(p.recordedAt.getTime());
      else byEmployee.set(p.employeeId, [p.recordedAt.getTime()]);
    }
    return employees.map((e) => {
      const from = parseTimeOnDate(now, e.workStartTime).getTime();
      const to = Math.max(from, Math.min(now.getTime(), parseTimeOnDate(now, e.workEndTime).getTime()));
      const times = byEmployee.get(e.id) ?? [];
      return {
        employeeId: e.id,
        windowMinutes: Math.round((to - from) / 60_000),
        coveredMinutes: Math.round(coveredMs(times, from, to) / 60_000),
        points: times.length,
        firstAt: times.length ? new Date(times[0]) : null,
        lastAt: times.length ? new Date(times[times.length - 1]) : null,
      };
    });
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
        deviceStatus: true,
        deviceStatusAt: true,
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
        insideAssignedZone: e.assignedMahallaCodes.length > 0 && e.lastInsideAssignedZone,
        assignedMahallaCodes: e.assignedMahallaCodes,
        lastLocationAt: e.lastLocationAt,
        ageMinutes,
        hasLocation: e.lastLat !== null && e.lastLng !== null,
        isStale: ageMinutes === null || ageMinutes > staleMinutes,
        deviceStatus: e.deviceStatus,
        deviceStatusAt: e.deviceStatusAt,
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
