import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ZoneKind } from '@prisma/client';
import {
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
}
