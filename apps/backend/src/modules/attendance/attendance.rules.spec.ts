import { AttendanceType } from '@prisma/client';
import { AttendanceService } from './attendance.service';

const OFFICE = { lat: 41.311081, lng: 69.240562 };

function at(h: number, m: number, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function employee(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    fullName: id,
    position: 'Inspektor',
    phone: '+998900000000',
    avatarUrl: null,
    department: null,
    workStartTime: '09:00',
    workEndTime: '18:00',
    officeLat: null,
    officeLng: null,
    officeRadiusM: null,
    assignedMahallaCodes: [],
    lastLocationAt: null,
    lastMahallaName: null,
    lastInsideAssignedZone: true,
    ...over,
  };
}

function build(opts: {
  employees?: unknown[];
  records?: unknown[];
  leaves?: unknown[];
  workDays?: number[];
  mahalla?: { code: string; nameUzLat: string } | null;
  nearZone?: boolean;
}) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    employee: {
      findMany: jest.fn().mockResolvedValue(opts.employees ?? []),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          (opts.employees as { id: string }[] | undefined)?.find((e) => e.id === where.id) ?? null,
        ),
      ),
    },
    attendanceRecord: {
      findMany: jest.fn().mockResolvedValue(opts.records ?? []),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve(data);
      }),
    },
    leaveRequest: { findMany: jest.fn().mockResolvedValue(opts.leaves ?? []) },
    faceTemplate: { findMany: jest.fn().mockResolvedValue([{ embedding: [1, 0] }]) },
  };
  const cfg: Record<string, unknown> = {
    attendance: {
      geofenceRadiusM: 200,
      officeLatitude: OFFICE.lat,
      officeLongitude: OFFICE.lng,
      faceMatchThreshold: 0.7,
    },
    location: { staleMinutes: 15 },
    work: {
      startTime: '09:00',
      endTime: '18:00',
      lateGraceMinutes: 0,
      workDays: opts.workDays ?? [0, 1, 2, 3, 4, 5, 6],
    },
  };
  const zones = {
    locate: jest.fn().mockResolvedValue({ insideDistrict: true, district: null, mahalla: opts.mahalla ?? null }),
    isWithinToleranceOfMahallas: jest.fn().mockResolvedValue(opts.nearZone ?? false),
  };
  const service = new AttendanceService(
    prisma as never,
    { get: jest.fn((k: string) => cfg[k]) } as never,
    zones as never,
  );
  return { service, created };
}

const scan = (employeeId: string, type: AttendanceType, time: Date, over: Record<string, unknown> = {}) => ({
  id: `${employeeId}-${type}`,
  employeeId,
  type,
  faceScore: 0.9,
  latitude: OFFICE.lat,
  longitude: OFFICE.lng,
  isValid: true,
  reason: null,
  isLate: false,
  lateMinutes: 0,
  place: 'office',
  recordedAt: time,
  ...over,
});

describe('attendance rules', () => {
  it('approved whole-day leave → "leave", not absent', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { service } = build({
      employees: [employee('ali'), employee('vali')],
      leaves: [{ employeeId: 'ali', type: 'days', amount: 3, startDate: yesterday, startTime: null, reason: "Mehnat ta'tili" }],
    });
    const res = await service.today({});
    const ali = res.roster.find((r) => r.employeeId === 'ali')!;
    expect(ali.status).toBe('leave');
    expect(ali.leave).toMatchObject({ type: 'days', reason: "Mehnat ta'tili" });
    expect(res.summary).toMatchObject({ onLeave: 1, absent: 1 });
  });

  it('non-working day → nobody is absent', async () => {
    const today = new Date().getDay();
    const { service } = build({
      employees: [employee('ali')],
      workDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== today),
    });
    const res = await service.today({});
    expect(res.isWorkday).toBe(false);
    expect(res.roster[0].status).toBe('dayoff');
    expect(res.summary.absent).toBe(0);
  });

  it('hours-leave covering the morning excuses lateness inside the window', async () => {
    const { service } = build({
      employees: [employee('ali')],
      records: [scan('ali', AttendanceType.CHECK_IN, at(10, 30), { isLate: true, lateMinutes: 90 })],
      leaves: [{ employeeId: 'ali', type: 'hours', amount: 2, startDate: at(0, 0), startTime: '09:00', reason: 'Shifokorga' }],
    });
    const ali = (await service.today({})).roster[0];
    expect(ali.status).toBe('present');
    expect(ali.checkIn?.isLate).toBe(false);
    expect(ali.excused).toBe(true);
    expect(ali.leave).toMatchObject({ type: 'hours', from: '09:00', to: '11:00' });
  });

  it('...but not lateness past the window', async () => {
    const { service } = build({
      employees: [employee('ali')],
      records: [scan('ali', AttendanceType.CHECK_IN, at(11, 30), { isLate: true, lateMinutes: 150 })],
      leaves: [{ employeeId: 'ali', type: 'hours', amount: 2, startDate: at(0, 0), startTime: '09:00', reason: 'Shifokorga' }],
    });
    const ali = (await service.today({})).roster[0];
    expect(ali.status).toBe('late');
    expect(ali.excused).toBe(false);
  });

  it('leaving inside a permitted evening window is not "early"', async () => {
    const { service } = build({
      employees: [employee('ali')],
      records: [
        scan('ali', AttendanceType.CHECK_IN, at(8, 50)),
        scan('ali', AttendanceType.CHECK_OUT, at(16, 10)),
      ],
      leaves: [{ employeeId: 'ali', type: 'hours', amount: 2, startDate: at(0, 0), startTime: '16:00', reason: 'Bolani olish' }],
    });
    const ali = (await service.today({})).roster[0];
    expect(ali.earlyLeaveMinutes).toBe(0);
    expect(ali.excused).toBe(true);
  });

  it('own office overrides the global one; assigned mahalla also counts', async () => {
    const field = employee('field', { assignedMahallaCodes: ['M1'], officeLat: 41.35, officeLng: 69.33, officeRadiusM: 150 });
    const { service } = build({ employees: [field], mahalla: { code: 'M1', nameUzLat: 'Bo‘z' } });
    const wp = service.workplaceOf(field as never);
    expect(wp).toMatchObject({ officeLat: 41.35, radiusM: 150, zones: ['M1'] });

    const inZone = await service.precheck('field', { latitude: 41.30, longitude: 69.30 });
    expect(inZone).toMatchObject({ allowed: true, place: 'zone', mahallaName: 'Bo‘z' });
    expect(inZone.message).toContain('mahalla');
  });

  it('precheck explains how far away you are', async () => {
    const { service } = build({ employees: [employee('ali')] });
    const res = await service.precheck('ali', { latitude: 41.3111, longitude: 69.3402 }); // ~8.4 km east
    expect(res.allowed).toBe(false);
    expect(res.place).toBeNull();
    expect(res.distanceM).toBeGreaterThan(8000);
    expect(res.message).toMatch(/8\.\d km uzoqdasiz/);
    const near = await service.precheck('ali', { latitude: OFFICE.lat + 0.0005, longitude: OFFICE.lng });
    expect(near).toMatchObject({ allowed: true, place: 'office' });
  });

  it('a check-in stores where it was accepted', async () => {
    const { service, created } = build({ employees: [employee('ali')] });
    await service.checkIn('ali', { latitude: OFFICE.lat, longitude: OFFICE.lng, embedding: [1, 0] });
    expect(created[0]).toMatchObject({ isValid: true, place: 'office' });

    await service.checkIn('ali', { latitude: 41.3111, longitude: 69.3402, embedding: [1, 0] });
    expect(created[1]).toMatchObject({ isValid: false, place: null });
    expect(String(created[1].reason)).toMatch(/m from office, outside 200m geofence/);
  });
});
