import { OverviewService } from './overview.service';

const H = 3_600_000;

function build(apps: unknown[], legacy: unknown[] = []) {
  const prisma = {
    application: { findMany: jest.fn().mockResolvedValue(apps) },
    citizenRequest: { findMany: jest.fn().mockResolvedValue(legacy) },
    employee: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'e1', position: 'Inspektor', lastLocationAt: new Date(), lastInsideAssignedZone: true, lastInsideOffice: false },
        { id: 'e2', position: 'Inspektor', lastLocationAt: new Date(), lastInsideAssignedZone: false, lastInsideOffice: false },
        { id: 'e3', position: 'Inspektor', lastLocationAt: null, lastInsideAssignedZone: true, lastInsideOffice: false },
      ]),
    },
    attendanceRecord: {
      findMany: jest.fn().mockResolvedValue([
        { employeeId: 'e1', isLate: false },
        { employeeId: 'e2', isLate: true },
        { employeeId: 'e2', isLate: false }, // second scan the same day — ignored
      ]),
    },
  };
  const zones = {
    locate: jest.fn().mockResolvedValue({
      insideDistrict: true,
      district: null,
      mahalla: { code: 'M1', nameUzLat: 'Yalang\'och', nameUzCyr: null, nameRu: null },
    }),
  };
  const config = { get: jest.fn().mockReturnValue({ staleMinutes: 30 }) };
  return new OverviewService(prisma as never, zones as never, config as never);
}

function app(over: Record<string, unknown>) {
  const createdAt = new Date(Date.now() - 10 * H);
  return {
    id: Math.random().toString(36).slice(2),
    subject: "[ARIZA|Elektr] Ko'cha chirog'i",
    description: 'yonmayapti',
    status: 'NEW',
    priority: 'medium',
    createdAt,
    resolvedAt: null,
    dueAt: new Date(createdAt.getTime() + 120 * H),
    rating: null,
    lat: 41.34,
    lng: 69.37,
    address: 'Yalang\'och MFY',
    district: null,
    applicantFullName: 'Fuqaro',
    assignedEmployee: null,
    ...over,
  };
}

describe('OverviewService', () => {
  it('folds citizen + legacy murojaats into honest KPIs', async () => {
    const now = Date.now();
    const svc = build(
      [
        app({ status: 'NEW' }), // open, unassigned
        app({ status: 'IN_PROGRESS', dueAt: new Date(now - H), assignedEmployee: { id: 'e1', fullName: 'A', avatarUrl: null } }), // overdue
        app({
          status: 'RESOLVED',
          createdAt: new Date(now - 30 * H),
          resolvedAt: new Date(now - 10 * H), // 20 h, within 120 h SLA
          dueAt: new Date(now + 90 * H),
          rating: 5,
          assignedEmployee: { id: 'e1', fullName: 'A', avatarUrl: null },
        }),
      ],
      [
        {
          id: 'R-1',
          title: 'Eski',
          category: 'suv',
          status: 'resolved',
          priority: 'high',
          createdAt: new Date(now - 200 * H),
          resolvedAt: null,
          responseHours: 60, // > 48 h high-priority SLA
          feedback: 3,
          lat: 41.3,
          lng: 69.3,
          address: '',
          citizenName: 'B',
        },
      ],
    );

    const o = await svc.overview();
    expect(o.murojaat).toMatchObject({
      total: 4,
      open: 2,
      overdue: 1,
      unassigned: 1,
      resolved: 2,
      resolutionRate: 50,
      slaRate: 50, // one of two resolved closed within SLA
      avgRating: 4,
      ratedCount: 2,
    });
    expect(o.workforce).toMatchObject({
      total: 3,
      checkedIn: 2,
      lateToday: 1, // first scan of e2 was late
      notCheckedIn: 1,
      reportingNow: 2,
      insideZone: 1,
      outsideZone: 1,
      neverReported: 1,
      onTimeRate: 50,
    });
    expect(o.topEmployees[0]).toMatchObject({ id: 'e1', resolved: 1, open: 1, overdue: 1, avgRating: 5 });
    expect(o.pins).toHaveLength(2); // only open ones
    expect(o.mahallas[0]).toMatchObject({ code: 'M1', total: 4, open: 2, overdue: 1 });
    expect(o.trend.daily).toHaveLength(30);
    expect(o.trend.monthly).toHaveLength(12);
    expect(o.categories.find((c) => c.category === 'elektr')?.total).toBe(3);
  });

  it('skips map pins without real coordinates', async () => {
    const svc = build([app({ lat: null, lng: null })]);
    const o = await svc.overview();
    expect(o.pins).toHaveLength(0);
    expect(o.mahallas).toHaveLength(0);
    expect(o.murojaat.open).toBe(1);
  });
});
