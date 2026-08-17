import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmployeeRole, LocationSource, Prisma, ZoneKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../common/config/configuration';
import { distanceInMeters } from '../../common/geo/geo.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';

interface GeoFeature {
  properties: Record<string, unknown>;
  geometry: Prisma.InputJsonValue;
}

interface FeatureCollection {
  features: GeoFeature[];
}

interface DemoEmployee {
  phone: string;
  fullName: string;
  position: string;
  point: { lat: number; lng: number } | null; // null => never reported (stale)
  minutesAgo: number;
}

/**
 * Idempotent, self-contained seeding that runs on every app boot (independent
 * of prisma/seed.ts, which other lanes own). Seeds:
 *   1. Zones — the real Mirzo Ulug'bek district + 70 mahallas (from GeoJSON).
 *   2. The web-admin super-admin (from ADMIN_USERNAME/ADMIN_PASSWORD).
 *   3. Optional demo employees + recent locations so the live map isn't empty.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly zones: ZonesService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const districtCode = await this.seedZones();
      await this.zones.reload();
      await this.seedAdmin();
      if (this.config.get('admin', { infer: true }).seedDemoData) {
        await this.seedDemoEmployees(districtCode);
      }
    } catch (error) {
      this.logger.error(`Bootstrap seeding failed: ${String(error)}`);
    }
  }

  // ---------------------------------------------------------------- zones ---

  private resolveDataFile(file: string): string | null {
    const candidates = [
      join(process.cwd(), 'prisma', 'data', file),
      join(__dirname, '..', '..', '..', 'prisma', 'data', file),
      join(__dirname, '..', '..', '..', '..', 'prisma', 'data', file),
    ];
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  private load(file: string): FeatureCollection | null {
    const path = this.resolveDataFile(file);
    if (!path) {
      this.logger.warn(`Zone data file not found: ${file}`);
      return null;
    }
    return JSON.parse(readFileSync(path, 'utf-8')) as FeatureCollection;
  }

  private num(v: unknown, fallback = 0): number {
    return typeof v === 'number' ? v : fallback;
  }

  private str(v: unknown): string | null {
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  /** Seeds zones; returns the district code (mahalla parentCode). */
  private async seedZones(): Promise<string | null> {
    let districtCode: string | null = null;

    const district = this.load('district.geojson');
    if (district?.features?.length) {
      const f = district.features[0];
      const p = f.properties;
      const bbox = (p.bbox as number[]) ?? [0, 0, 0, 0];
      const centroid = (p.centroid as number[]) ?? [0, 0];
      districtCode = this.str(p.district_code) ?? 'DISTRICT';
      await this.prisma.zone.upsert({
        where: { code: districtCode },
        create: this.zoneData(ZoneKind.DISTRICT, districtCode, null, p, bbox, centroid, f.geometry),
        update: this.zoneData(ZoneKind.DISTRICT, districtCode, null, p, bbox, centroid, f.geometry),
      });
    }

    const mahallas = this.load('mahallas.geojson');
    if (mahallas?.features?.length) {
      for (const f of mahallas.features) {
        const p = f.properties;
        const code = this.str(p.id);
        if (!code) {
          continue;
        }
        const bbox = (p.bbox as number[]) ?? [0, 0, 0, 0];
        const centroid = (p.centroid as number[]) ?? [0, 0];
        await this.prisma.zone.upsert({
          where: { code },
          create: this.zoneData(ZoneKind.MAHALLA, code, districtCode, p, bbox, centroid, f.geometry),
          update: this.zoneData(ZoneKind.MAHALLA, code, districtCode, p, bbox, centroid, f.geometry),
        });
      }
    }

    const total = await this.prisma.zone.count();
    this.logger.log(`Zones seeded (${total} total; district=${districtCode})`);
    return districtCode;
  }

  private zoneData(
    kind: ZoneKind,
    code: string,
    parentCode: string | null,
    p: Record<string, unknown>,
    bbox: number[],
    centroid: number[],
    geometry: Prisma.InputJsonValue,
  ): Prisma.ZoneUncheckedCreateInput {
    return {
      kind,
      code,
      soato: this.str(p.soato),
      nameUzLat: this.str(p.name_uz_lt) ?? code,
      nameUzCyr: this.str(p.name_uz_cyr) ?? this.str(p.name_uz_kr),
      nameRu: this.str(p.name_ru),
      parentCode,
      centroidLat: this.num(centroid[1]),
      centroidLng: this.num(centroid[0]),
      minLng: this.num(bbox[0]),
      minLat: this.num(bbox[1]),
      maxLng: this.num(bbox[2]),
      maxLat: this.num(bbox[3]),
      areaM2: typeof p.area_m2 === 'number' ? p.area_m2 : null,
      geometry,
    };
  }

  // ---------------------------------------------------------------- admin ---

  private async seedAdmin(): Promise<void> {
    const { seedUsername, seedPassword, seedFullName } = this.config.get('admin', {
      infer: true,
    });
    const username = seedUsername.trim();
    const existing = await this.prisma.adminUser.findUnique({ where: { username } });

    if (!existing) {
      let password = seedPassword;
      let generated = false;
      if (!password) {
        password = randomBytes(9).toString('base64url');
        generated = true;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await this.prisma.adminUser.create({
        data: {
          username,
          fullName: seedFullName,
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });
      if (generated) {
        this.logger.warn(
          `Seeded admin "${username}" with GENERATED password: ${password} — set ADMIN_PASSWORD to control it.`,
        );
      } else {
        this.logger.log(`Seeded admin "${username}".`);
      }
      return;
    }

    // Existing admin: if an explicit ADMIN_PASSWORD is set, keep the hash in
    // sync so ops can rotate the password purely via env.
    if (seedPassword) {
      const passwordHash = await bcrypt.hash(seedPassword, 10);
      await this.prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash, isActive: true },
      });
      this.logger.log(`Admin "${username}" password synced from ADMIN_PASSWORD.`);
    }
  }

  // ------------------------------------------------------------- demo data ---

  private demoEmployees(): DemoEmployee[] {
    return [
      { phone: '+998901112201', fullName: 'Akmal Karimov', position: 'Yetakchi mutaxassis', point: { lat: 41.3111, lng: 69.3402 }, minutesAgo: 2 },
      { phone: '+998901112202', fullName: 'Dilnoza Rahimova', position: 'Bosh mutaxassis', point: { lat: 41.3125, lng: 69.341 }, minutesAgo: 4 },
      { phone: '+998901112203', fullName: 'Sardor To‘xtayev', position: 'Inspektor', point: { lat: 41.3354, lng: 69.3737 }, minutesAgo: 7 },
      { phone: '+998901112204', fullName: 'Gulnora Yusupova', position: 'Mutaxassis', point: { lat: 41.315, lng: 69.31 }, minutesAgo: 12 },
      { phone: '+998901112205', fullName: 'Jasur Aliyev', position: 'Kuzatuvchi', point: { lat: 41.302, lng: 69.24 }, minutesAgo: 20 },
      { phone: '+998901112206', fullName: 'Malika Ismoilova', position: 'Mutaxassis', point: null, minutesAgo: 0 },
    ];
  }

  private async seedDemoEmployees(districtCode: string | null): Promise<void> {
    const att = this.config.get('attendance', { infer: true });
    const office = { lat: att.officeLatitude, lng: att.officeLongitude, radiusM: att.geofenceRadiusM };

    for (const demo of this.demoEmployees()) {
      const employee = await this.prisma.employee.upsert({
        where: { phone: demo.phone },
        update: {},
        create: {
          fullName: demo.fullName,
          phone: demo.phone,
          position: demo.position,
          region: 'Toshkent shahri',
          district: 'Mirzo Ulug‘bek',
          role: EmployeeRole.EMPLOYEE,
          isActive: true,
          officeLat: office.lat,
          officeLng: office.lng,
          officeRadiusM: office.radiusM,
        },
      });

      if (!demo.point) {
        continue; // stays "never reported" -> shows up in stale alerts
      }

      // Only seed a location if this employee has none yet (idempotent).
      const existingCount = await this.prisma.employeeLocation.count({
        where: { employeeId: employee.id },
      });
      if (existingCount > 0) {
        continue;
      }

      const locate = await this.zones.locate(demo.point.lat, demo.point.lng);
      const distanceToOfficeM = Math.round(
        distanceInMeters(demo.point.lat, demo.point.lng, office.lat, office.lng),
      );
      const insideOffice = distanceToOfficeM <= office.radiusM;
      const recordedAt = new Date(Date.now() - demo.minutesAgo * 60_000);

      await this.prisma.employeeLocation.create({
        data: {
          employeeId: employee.id,
          latitude: demo.point.lat,
          longitude: demo.point.lng,
          accuracy: 12,
          source: LocationSource.FOREGROUND,
          mahallaCode: locate.mahalla?.code ?? null,
          mahallaName: locate.mahalla?.nameUzLat ?? null,
          insideDistrict: locate.insideDistrict,
          insideOffice,
          distanceToOfficeM,
          recordedAt,
        },
      });

      await this.prisma.employee.update({
        where: { id: employee.id },
        data: {
          homeMahallaCode: locate.mahalla?.code ?? districtCode,
          lastLat: demo.point.lat,
          lastLng: demo.point.lng,
          lastAccuracyM: 12,
          lastLocationAt: recordedAt,
          lastMahallaCode: locate.mahalla?.code ?? null,
          lastMahallaName: locate.mahalla?.nameUzLat ?? null,
          lastInsideDistrict: locate.insideDistrict,
          lastInsideOffice: insideOffice,
          staleAlertedAt: null,
        },
      });
    }

    this.logger.log('Demo employees + locations ensured.');
  }
}
