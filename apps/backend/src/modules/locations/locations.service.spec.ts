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
    isWithinToleranceOfMahallas: jest.fn().mockResolvedValue(false),
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
        assignedMahallaCodes: [],
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
      // Order matches Promise.all:
      // [totalActive, reportingNow, insideOffice, stale, neverReported].
      prisma.employee.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      const stats = await service.getStats();

      expect(stats).toEqual({
        totalActive: 10,
        reportingNow: 7,
        insideOffice: 5,
        stale: 3,
        neverReported: 2,
        staleMinutes: 30,
      });
      expect(prisma.employee.count).toHaveBeenCalledTimes(5);
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
  describe('hudud o‘zgarganda qayta hisoblash (reevaluateTerritory)', () => {
    const emp = (over: Record<string, unknown> = {}) => ({
      id: 'e1',
      officeLat: null,
      officeLng: null,
      officeRadiusM: null,
      assignedMahallaCodes: ['M1'],
      lastLocationAt: new Date(),
      lastLat: 41.4,
      lastLng: 69.5,
      lastAccuracyM: 10,
      lastMahallaCode: 'M2',
      lastInsideDistrict: true,
      ...over,
    });

    it('oxirgi lokatsiya yangi hududga ko‘ra darhol Hududda/Tashqarida bo‘ladi', async () => {
      const { service, prisma } = buildDeps();
      (prisma as any).$executeRaw = jest.fn().mockResolvedValue(0);
      prisma.employeeLocation.findMany.mockResolvedValue([]);

      prisma.employee.findUnique.mockResolvedValue(emp());
      expect((await service.reevaluateTerritory('e1')).insideAssignedZone).toBe(false);
      expect(prisma.employee.update).toHaveBeenLastCalledWith({
        where: { id: 'e1' },
        data: { lastInsideOffice: false, lastInsideAssignedZone: false },
      });

      // The mahalla the employee is standing in gets assigned → inside at once.
      prisma.employee.findUnique.mockResolvedValue(emp({ assignedMahallaCodes: ['M1', 'M2'] }));
      expect((await service.reevaluateTerritory('e1')).insideAssignedZone).toBe(true);

      // Nothing assigned → the whole district counts.
      prisma.employee.findUnique.mockResolvedValue(emp({ assignedMahallaCodes: [] }));
      expect((await service.reevaluateTerritory('e1')).insideAssignedZone).toBe(true);
    });

    it('bugungi nuqtalardan faqat o‘zgarganlari yangilanadi', async () => {
      const { service, prisma } = buildDeps();
      const exec = jest.fn().mockResolvedValue(1);
      (prisma as any).$executeRaw = exec;
      prisma.employee.findUnique.mockResolvedValue(emp({ assignedMahallaCodes: ['M2'] }));
      const base = { latitude: 41.4, longitude: 69.5, accuracy: 10, insideDistrict: true, insideOffice: false };
      const dist = Math.round(
        // same office the service resolves from config
        require('../../common/geo/geo.util').distanceInMeters(41.4, 69.5, OFFICE.officeLatitude, OFFICE.officeLongitude),
      );
      prisma.employeeLocation.findMany.mockResolvedValue([
        { id: 'a', ...base, mahallaCode: 'M2', insideAssignedZone: false, distanceToOfficeM: dist }, // flips to inside
        { id: 'b', ...base, mahallaCode: 'M2', insideAssignedZone: true, distanceToOfficeM: dist }, // already right
        { id: 'c', ...base, mahallaCode: 'M9', insideAssignedZone: true, distanceToOfficeM: dist }, // flips to outside
      ]);
      const res = await service.reevaluateTerritory('e1');
      expect(res.fixesUpdated).toBe(2);
      expect(exec).toHaveBeenCalledTimes(1);
      const args = exec.mock.calls[0].slice(1);
      expect(args[0]).toEqual(['a', 'c']);
      expect(args[1]).toEqual([true, false]);
    });

    it('lokatsiyasi yo‘q xodim "tashqarida" bo‘lib qolmaydi; yo‘q xodim — 404', async () => {
      const { service, prisma } = buildDeps();
      prisma.employeeLocation.findMany.mockResolvedValue([]);
      prisma.employee.findUnique.mockResolvedValue(emp({ lastLocationAt: null, lastLat: null, lastLng: null }));
      expect(await service.reevaluateTerritory('e1')).toEqual({ insideAssignedZone: null, fixesUpdated: 0 });
      expect(prisma.employee.update).toHaveBeenLastCalledWith({
        where: { id: 'e1' },
        data: { lastInsideAssignedZone: true },
      });
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.reevaluateTerritory('x')).rejects.toThrow(/not found/i);
    });

    it('noma’lum mahalla kodi rad etiladi; takrorlar olib tashlanadi', async () => {
      const { service, zones } = buildDeps();
      (zones as any).listZones = jest.fn().mockResolvedValue([{ code: 'M1' }, { code: 'M2' }]);
      expect(await service.normalizeMahallaCodes([' M1', 'M2', 'M1', ''])).toEqual(['M1', 'M2']);
      await expect(service.normalizeMahallaCodes(['M1', 'ZZ'])).rejects.toThrow(/Bunday mahalla yo'q: ZZ/);
      expect(await service.normalizeMahallaCodes([])).toEqual([]);
    });
  });
});
