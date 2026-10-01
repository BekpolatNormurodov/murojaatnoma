import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ZoneKind } from '@prisma/client';
import {
  distanceToGeometryEdgeM,
  GeoJsonAreaGeometry,
  pointInGeometry,
  withinBBox,
} from '../../common/geo/geo.util';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CachedZone {
  code: string;
  kind: ZoneKind;
  soato: string | null;
  nameUzLat: string;
  nameUzCyr: string | null;
  nameRu: string | null;
  parentCode: string | null;
  centroidLat: number;
  centroidLng: number;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  areaM2: number | null;
  geometry: GeoJsonAreaGeometry;
}

export interface ZoneRef {
  code: string;
  nameUzLat: string;
  nameUzCyr: string | null;
  nameRu: string | null;
}

/**
 * Geofence slack (m) for "inside an assigned mahalla" checks — absorbs GPS
 * jitter at a boundary. Mahallas are only ~500 m across, so a strict
 * point-in-polygon marks someone standing just inside their own mahalla as
 * outside whenever GPS drifts a few metres. Tolerance = base + the fix's own
 * accuracy (capped, so a garbage fix can't widen the zone without bound).
 * Shared by live tracking and attendance so both apply the same rule.
 */
export const ZONE_TOLERANCE_BASE_M = 35;
export const ZONE_TOLERANCE_ACCURACY_CAP_M = 75;

export function zoneToleranceM(accuracy?: number | null): number {
  return ZONE_TOLERANCE_BASE_M + Math.min(accuracy ?? 0, ZONE_TOLERANCE_ACCURACY_CAP_M);
}

export interface LocateResult {
  insideDistrict: boolean;
  district: ZoneRef | null;
  mahalla: ZoneRef | null;
}

/**
 * In-memory cache of administrative zones (district + mahallas) backed by the
 * `Zone` table. Serves GeoJSON for maps and does point-in-polygon "which
 * mahalla is this?" lookups on the hot location-ingest path.
 */
@Injectable()
export class ZonesService implements OnModuleInit {
  private readonly logger = new Logger(ZonesService.name);
  private cache: CachedZone[] = [];
  private loaded = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureLoaded();
    } catch (error) {
      // The bootstrap seeder may not have populated zones yet; it will call
      // reload() once seeding finishes.
      this.logger.warn(`Zone cache not loaded on init: ${String(error)}`);
    }
  }

  /** Loads the cache once; subsequent calls are no-ops until reload(). */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    await this.reload();
  }

  /** Force-refresh the cache from the DB (called by the bootstrap seeder). */
  async reload(): Promise<void> {
    const zones = await this.prisma.zone.findMany();
    this.cache = zones.map((z) => ({
      code: z.code,
      kind: z.kind,
      soato: z.soato,
      nameUzLat: z.nameUzLat,
      nameUzCyr: z.nameUzCyr,
      nameRu: z.nameRu,
      parentCode: z.parentCode,
      centroidLat: z.centroidLat,
      centroidLng: z.centroidLng,
      minLat: z.minLat,
      minLng: z.minLng,
      maxLat: z.maxLat,
      maxLng: z.maxLng,
      areaM2: z.areaM2,
      geometry: z.geometry as unknown as GeoJsonAreaGeometry,
    }));
    this.loaded = true;
    this.logger.log(`Loaded ${this.cache.length} zones into cache`);
  }

  private toRef(z: CachedZone): ZoneRef {
    return {
      code: z.code,
      nameUzLat: z.nameUzLat,
      nameUzCyr: z.nameUzCyr,
      nameRu: z.nameRu,
    };
  }

  private toFeature(z: CachedZone): Record<string, unknown> {
    return {
      type: 'Feature',
      properties: {
        code: z.code,
        kind: z.kind,
        soato: z.soato,
        name_uz_lt: z.nameUzLat,
        name_uz_cyr: z.nameUzCyr,
        name_ru: z.nameRu,
        parent_code: z.parentCode,
        centroid: [z.centroidLng, z.centroidLat],
        area_m2: z.areaM2,
      },
      geometry: z.geometry,
    };
  }

  /** Metadata only (no geometry) for list UIs / dropdowns. */
  async listZones(kind?: ZoneKind): Promise<Array<Omit<CachedZone, 'geometry'>>> {
    await this.ensureLoaded();
    return this.cache
      .filter((z) => !kind || z.kind === kind)
      .map((z) => ({
        code: z.code,
        kind: z.kind,
        soato: z.soato,
        nameUzLat: z.nameUzLat,
        nameUzCyr: z.nameUzCyr,
        nameRu: z.nameRu,
        parentCode: z.parentCode,
        centroidLat: z.centroidLat,
        centroidLng: z.centroidLng,
        minLat: z.minLat,
        minLng: z.minLng,
        maxLat: z.maxLat,
        maxLng: z.maxLng,
        areaM2: z.areaM2,
      }));
  }

  /** GeoJSON FeatureCollection for map rendering. */
  async getGeoJson(kind?: ZoneKind): Promise<Record<string, unknown>> {
    await this.ensureLoaded();
    const features = this.cache
      .filter((z) => !kind || z.kind === kind)
      .map((z) => this.toFeature(z));
    return { type: 'FeatureCollection', features };
  }

  /** Point-in-polygon: which mahalla (and is it inside the district) is (lat,lng)? */
  async locate(lat: number, lng: number): Promise<LocateResult> {
    await this.ensureLoaded();

    const districtZone = this.cache.find((z) => z.kind === ZoneKind.DISTRICT) ?? null;
    const insideDistrict = districtZone
      ? withinBBox(
          lat,
          lng,
          districtZone.minLat,
          districtZone.minLng,
          districtZone.maxLat,
          districtZone.maxLng,
        ) && pointInGeometry(lng, lat, districtZone.geometry)
      : false;

    let mahalla: ZoneRef | null = null;
    for (const z of this.cache) {
      if (z.kind !== ZoneKind.MAHALLA) {
        continue;
      }
      if (!withinBBox(lat, lng, z.minLat, z.minLng, z.maxLat, z.maxLng)) {
        continue;
      }
      if (pointInGeometry(lng, lat, z.geometry)) {
        mahalla = this.toRef(z);
        break;
      }
    }

    return {
      insideDistrict,
      district: districtZone ? this.toRef(districtZone) : null,
      mahalla,
    };
  }

  /**
   * Is (lat,lng) inside, OR within [toleranceM] of, ANY of the given mahalla
   * codes? Tolerance absorbs GPS jitter near a boundary: a mahalla is only
   * ~500 m across, so a 10-30 m GPS error otherwise flips a staffer standing
   * just inside their own mahalla to "hududdan tashqarida".
   *
   * Exact: strict point-in-polygon first, then the true shortest distance to
   * the polygon edges (see `distanceToGeometryEdgeM`).
   */
  async isWithinToleranceOfMahallas(
    lat: number,
    lng: number,
    codes: string[],
    toleranceM: number,
  ): Promise<boolean> {
    await this.ensureLoaded();
    if (codes.length === 0 || toleranceM <= 0) {
      return false;
    }
    const codeSet = new Set(codes);
    // metres → degrees, only for the cheap bbox pre-filter.
    const dLat = toleranceM / 111_320;
    const dLng = toleranceM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));

    for (const z of this.cache) {
      if (z.kind !== ZoneKind.MAHALLA || !codeSet.has(z.code)) continue;
      if (!withinBBox(lat, lng, z.minLat - dLat, z.minLng - dLng, z.maxLat + dLat, z.maxLng + dLng)) {
        continue;
      }
      if (pointInGeometry(lng, lat, z.geometry)) return true;
      if (distanceToGeometryEdgeM(lng, lat, z.geometry) <= toleranceM) return true;
    }
    return false;
  }
}
