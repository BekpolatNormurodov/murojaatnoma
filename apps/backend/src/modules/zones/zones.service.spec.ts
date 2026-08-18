import { ZoneKind } from '@prisma/client';
import { ZonesService } from './zones.service';

/**
 * A DISTRICT (large square) with two disjoint MAHALLA squares inside it.
 * GeoJSON coordinates are [lng, lat]; bbox + centroid match each polygon.
 */
function fixtureZones() {
  return [
    {
      code: 'D1',
      kind: ZoneKind.DISTRICT,
      soato: '1700000',
      nameUzLat: 'Test tuman',
      nameUzCyr: null,
      nameRu: null,
      parentCode: null,
      centroidLat: 41.5,
      centroidLng: 69.5,
      minLat: 41.0,
      minLng: 69.0,
      maxLat: 42.0,
      maxLng: 70.0,
      areaM2: null,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [69.0, 41.0],
            [69.0, 42.0],
            [70.0, 42.0],
            [70.0, 41.0],
            [69.0, 41.0],
          ],
        ],
      },
    },
    {
      code: 'MA',
      kind: ZoneKind.MAHALLA,
      soato: '1700001',
      nameUzLat: 'Mahalla A',
      nameUzCyr: null,
      nameRu: null,
      parentCode: 'D1',
      centroidLat: 41.31,
      centroidLng: 69.34,
      minLat: 41.3,
      minLng: 69.33,
      maxLat: 41.32,
      maxLng: 69.35,
      areaM2: null,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [69.33, 41.3],
            [69.33, 41.32],
            [69.35, 41.32],
            [69.35, 41.3],
            [69.33, 41.3],
          ],
        ],
      },
    },
    {
      code: 'MB',
      kind: ZoneKind.MAHALLA,
      soato: '1700002',
      nameUzLat: 'Mahalla B',
      nameUzCyr: null,
      nameRu: null,
      parentCode: 'D1',
      centroidLat: 41.41,
      centroidLng: 69.44,
      minLat: 41.4,
      minLng: 69.43,
      maxLat: 41.42,
      maxLng: 69.45,
      areaM2: null,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [69.43, 41.4],
            [69.43, 41.42],
            [69.45, 41.42],
            [69.45, 41.4],
            [69.43, 41.4],
          ],
        ],
      },
    },
  ];
}

describe('ZonesService', () => {
  let service: ZonesService;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue(fixtureZones());
    const prisma = { zone: { findMany } };
    service = new ZonesService(prisma as any);
    await service.reload();
  });

  describe('locate', () => {
    it('returns mahalla A for a point inside A', async () => {
      const result = await service.locate(41.31, 69.34);
      expect(result.insideDistrict).toBe(true);
      expect(result.mahalla?.code).toBe('MA');
      expect(result.district?.code).toBe('D1');
    });

    it('returns mahalla B for a point inside B', async () => {
      const result = await service.locate(41.41, 69.44);
      expect(result.mahalla?.code).toBe('MB');
    });

    it('returns null mahalla but insideDistrict for a point in the district only', async () => {
      const result = await service.locate(41.6, 69.6);
      expect(result.insideDistrict).toBe(true);
      expect(result.mahalla).toBeNull();
    });

    it('returns insideDistrict:false for a point fully outside', async () => {
      const result = await service.locate(40.0, 68.0);
      expect(result.insideDistrict).toBe(false);
      expect(result.mahalla).toBeNull();
    });
  });

  describe('getGeoJson', () => {
    it('returns a FeatureCollection with the 2 mahalla features', async () => {
      const geojson = await service.getGeoJson(ZoneKind.MAHALLA);
      expect(geojson.type).toBe('FeatureCollection');
      const features = geojson.features as unknown[];
      expect(features).toHaveLength(2);
    });

    it('returns all 3 zones when no kind filter is given', async () => {
      const geojson = await service.getGeoJson();
      expect((geojson.features as unknown[]).length).toBe(3);
    });
  });

  describe('listZones', () => {
    it('returns metadata without geometry', async () => {
      const zones = await service.listZones();
      expect(zones).toHaveLength(3);
      for (const z of zones) {
        expect(z).not.toHaveProperty('geometry');
        expect(z).toHaveProperty('code');
        expect(z).toHaveProperty('centroidLat');
      }
    });

    it('filters by kind', async () => {
      const mahallas = await service.listZones(ZoneKind.MAHALLA);
      expect(mahallas.map((z) => z.code).sort()).toEqual(['MA', 'MB']);
    });
  });

  describe('reload / ensureLoaded', () => {
    it('caches zones so locate does not re-query on every call', async () => {
      // reload() already ran in beforeEach (1 call). ensureLoaded is a no-op now.
      await service.locate(41.31, 69.34);
      expect(findMany).toHaveBeenCalledTimes(1);
    });
  });
});
