import { AttendanceType } from '@prisma/client';
import { AttendanceService } from './attendance.service';

const OFFICE = { lat: 41.3381, lng: 69.3346 };

function at(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function employee(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    fullName: id.toUpperCase(),
    position: 'Inspektor',
    phone: `+99890000000${id.length}`,
    avatarUrl: null,
    department: null,
    workStartTime: '09:00',
    workEndTime: '18:00',
    lastLocationAt: null,
    lastMahallaName: null,
    lastInsideAssignedZone: true,
    ...over,
  };
}

function scan(employeeId: string, type: AttendanceType, time: Date, over: Record<string, unknown> = {}) {
  return {
    id: `${employeeId}-${type}-${time.getTime()}`,
    employeeId,
    type,
    faceScore: 0.93,
    latitude: OFFICE.lat,
    longitude: OFFICE.lng,
    isValid: true,
    reason: null,
    isLate: false,
    lateMinutes: 0,
    recordedAt: time,
    ...over,
  };
}

function build(employees: unknown[], records: unknown[], leaves: unknown[] = []) {
  const prisma = {
    employee: { findMany: jest.fn().mockResolvedValue(employees) },
    attendanceRecord: { findMany: jest.fn().mockResolvedValue(records) },
    leaveRequest: { findMany: jest.fn().mockResolvedValue(leaves) },
  };
  const cfg: Record<string, unknown> = {
    attendance: { geofenceRadiusM: 200, officeLatitude: OFFICE.lat, officeLongitude: OFFICE.lng },
    location: { staleMinutes: 15 },
    work: { startTime: '09:00', endTime: '18:00', workDays: [0, 1, 2, 3, 4, 5, 6] },
  };
  const config = { get: jest.fn((key: string) => cfg[key]) };
  const zones = {
    locate: jest.fn().mockResolvedValue({ insideDistrict: true, district: null, mahalla: null }),
    isWithinToleranceOfMahallas: jest.fn().mockResolvedValue(false),
  };
  return new AttendanceService(prisma as never, config as never, zones as never);
}

describe('AttendanceService.today (davomat board)', () => {
  it('pairs scans, keeps rejected attempts, flags early leave and live location', async () => {
    const fresh = new Date(Date.now() - 2 * 60_000);
    const service = build(
      [
        employee('ali', { lastLocationAt: fresh, lastMahallaName: 'Alpomish', lastInsideAssignedZone: false }),
        employee('vali'),
        employee('soli'),
      ],
      [
        // ali: late in, early out
        scan('ali', AttendanceType.CHECK_IN, at(9, 20), { isLate: true, lateMinutes: 20 }),
        scan('ali', AttendanceType.CHECK_OUT, at(16, 30)),
        // vali: a rejected attempt first, then a valid on-time scan, still working
        scan('vali', AttendanceType.CHECK_IN, at(8, 40), {
          isValid: false,
          faceScore: 0.41,
          reason: 'face score 0.41 below threshold 0.7',
        }),
        scan('vali', AttendanceType.CHECK_IN, at(8, 45)),
        // soli: only a rejected attempt -> still absent
        scan('soli', AttendanceType.CHECK_IN, at(9, 5), {
          isValid: false,
          latitude: OFFICE.lat + 0.05,
          reason: '5560m from office, outside 200m geofence',
        }),
      ],
    );

    const res = await service.today({});
    const byId = Object.fromEntries(res.roster.map((r) => [r.employeeId, r]));

    expect(byId.ali.status).toBe('left');
    expect(byId.ali.earlyLeaveMinutes).toBe(90);
    expect(byId.ali.checkIn).toMatchObject({ isLate: true, lateMinutes: 20, faceScore: 0.93, distanceM: 0 });
    expect(byId.ali.live).toMatchObject({ mahallaName: 'Alpomish', insideZone: false, stale: false });

    expect(byId.vali.status).toBe('present');
    expect(byId.vali.checkIn?.time).toEqual(at(8, 45));
    expect(byId.vali.failedScans).toHaveLength(1);
    expect(byId.vali.failedScans[0]).toMatchObject({ faceScore: 0.41, type: AttendanceType.CHECK_IN });
    expect(byId.vali.live).toBeNull();

    expect(byId.soli.status).toBe('absent');
    expect(byId.soli.checkIn).toBeNull();
    expect(byId.soli.failedScans[0].distanceM).toBeGreaterThan(5000);

    expect(res.summary).toMatchObject({
      total: 3,
      checkedIn: 2,
      workingNow: 1,
      lateTotal: 1, // ali was late even though he has left
      late: 0,
      onTime: 1,
      absent: 1,
      left: 1,
      earlyLeave: 1,
      withFailedScans: 2,
    });
    expect(res.workStartTime).toBe('09:00');
  });

  it('marks a live report older than staleMinutes as stale', async () => {
    const old = new Date(Date.now() - 40 * 60_000);
    const service = build([employee('ali', { lastLocationAt: old })], []);
    const res = await service.today({});
    expect(res.roster[0].live?.stale).toBe(true);
  });
});
