import { LocationsService } from './locations.service';

const OFFICE = {
  faceMatchThreshold: 0.5,
  geofenceRadiusM: 2000,
  officeLatitude: 41.3111,
  officeLongitude: 69.3402,
};

const LOCATION_CONFIG = { staleMinutes: 30 };

const LOCATE_RESULT = {
  insideDistrict: true,
  mahalla: {
    code: 'M1',
    nameUzLat: 'Test mahalla',
    nameUzCyr: null,
    nameRu: null,
  },
  district: {
    code: 'D1',
    nameUzLat: 'Test tuman',
    nameUzCyr: null,
    nameRu: null,
  },
};

function buildDeps() {
  const prisma = {
    employee: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employeeLocation: {
      create: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn(),
    },
  };
  const zones = {
    locate: jest.fn().mockResolvedValue(LOCATE_RESULT),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'attendance') return OFFICE;
      if (key === 'location') return LOCATION_CONFIG;
      throw new Error(`unexpected config key: ${key}`);
    }),
  };
  const service = new LocationsService(prisma as any, zones as any, config as any);
  return { service, prisma, zones, config };
}

describe('LocationsService', () => {
  describe('ingest', () => {
    it('marks insideOffice true for a point at the office and records the mahalla', async () => {
      const { service, prisma, zones } = buildDeps();
      prisma.employee.findUnique.mockResolvedValue({
        id: 'e1',
        officeLat: null,
        officeLng: null,
        officeRadiusM: null,
        lastLocationAt: null,
      });

      const result = await service.ingest('e1', {
        latitude: 41.3111,
        longitude: 69.3402,
      } as any);

      expect(zones.locate).toHaveBeenCalledWith(41.3111, 69.3402);
      expect(result.insideOffice).toBe(true);
      expect(result.distanceToOfficeM).toBe(0);
      expect(result.insideDistrict).toBe(true);
      expect(result.mahalla).toEqual({ code: 'M1', name: 'Test mahalla' });
      expect(result.id).toBe('loc-1');

      // Persists the raw report + denormalizes onto the employee row.
      expect(prisma.employeeLocation.create).toHaveBeenCalledTimes(1);
      expect(prisma.employee.update).toHaveBeenCalledTimes(1);
      const writtenData = prisma.employeeLocation.create.mock.calls[0][0].data;
      expect(writtenData.mahallaCode).toBe('M1');
      expect(writtenData.mahallaName).toBe('Test mahalla');
      expect(writtenData.insideOffice).toBe(true);
    });

    it('marks insideOffice false for a point ~5km from the office', async () => {
      const { service, prisma } = buildDeps();
      prisma.employee.findUnique.mockResolvedValue({
        id: 'e1',
        officeLat: null,
        officeLng: null,
        officeRadiusM: null,
        lastLocationAt: null,
      });

      // ~0.05 deg latitude north ≈ 5.5km, outside the 2000m geofence.
      const result = await service.ingest('e1', {
        latitude: 41.3611,
        longitude: 69.3402,
      } as any);

      expect(result.insideOffice).toBe(false);
      expect(result.distanceToOfficeM).toBeGreaterThan(2000);
    });
  });

  describe('getStats', () => {
    it('returns the counts from prisma and the configured staleMinutes', async () => {
      const { service, prisma } = buildDeps();
      // Order matches Promise.all: [totalActive, reportingNow, insideOffice, stale].
      prisma.employee.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);

      const stats = await service.getStats();

      expect(stats).toEqual({
        totalActive: 10,
        reportingNow: 7,
        insideOffice: 5,
        stale: 3,
        staleMinutes: 30,
      });
      expect(prisma.employee.count).toHaveBeenCalledTimes(4);
    });
  });

  describe('getAlerts', () => {
    it("maps reason 'never' for null lastLocationAt and 'stale' otherwise", async () => {
      const { service, prisma } = buildDeps();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'e-never',
          fullName: 'Never Reporter',
          position: 'Inspektor',
          phone: '+998900000001',
          avatarUrl: null,
          lastLocationAt: null,
          lastMahallaName: null,
          staleAlertedAt: null,
        },
        {
          id: 'e-stale',
          fullName: 'Stale Reporter',
          position: 'Inspektor',
          phone: '+998900000002',
          avatarUrl: null,
          lastLocationAt: oneHourAgo,
          lastMahallaName: 'Test mahalla',
          staleAlertedAt: new Date(),
        },
      ]);

      const alerts = await service.getAlerts();

      expect(alerts).toHaveLength(2);

      const never = alerts.find((a) => a.employeeId === 'e-never')!;
      expect(never.reason).toBe('never');
      expect(never.ageMinutes).toBeNull();
      expect(never.alerted).toBe(false);

      const stale = alerts.find((a) => a.employeeId === 'e-stale')!;
      expect(stale.reason).toBe('stale');
      expect(stale.ageMinutes).toBeGreaterThanOrEqual(59);
      expect(stale.alerted).toBe(true);
    });
  });
});
