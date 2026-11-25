import { ApplicationEventType, ApplicationStatus } from '@prisma/client';
import { OversightService } from './oversight.service';

function build(emp: { id: string; isActive: boolean } | null = { id: 'e1', isActive: true }) {
  const calls: Record<string, unknown[]> = {};
  const rec = (k: string) => jest.fn((arg: unknown) => ((calls[k] ??= []).push(arg), Promise.resolve({ count: 2 })));
  const prisma = {
    employee: {
      findUnique: jest.fn().mockResolvedValue(emp),
      update: rec('employee.update'),
      delete: rec('employee.delete'),
    },
    refreshToken: { updateMany: rec('refreshToken.updateMany') },
    deviceToken: { deleteMany: rec('deviceToken.deleteMany') },
    application: { updateMany: rec('application.updateMany'), findMany: jest.fn().mockResolvedValue([]) },
    applicationEvent: {
      findMany: jest.fn().mockResolvedValue([
        { applicationId: 'a1', createdAt: new Date('2026-10-01T10:00:00Z') },
        { applicationId: 'a1', createdAt: new Date('2026-10-01T12:00:00Z') },
        { applicationId: 'a2', createdAt: new Date('2026-10-02T09:00:00Z') },
      ]),
    },
    faceTemplate: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const svc = new OversightService(prisma as never, {} as never, {} as never, {} as never);
  return { svc, prisma, calls };
}

describe('xodim CRUD — arxiv, tiklash, o‘chirish', () => {
  it('ishdan bo‘shatish: login yopiladi, sessiyalar bekor, ochiq murojaatlar bo‘shatiladi', async () => {
    const { svc, calls } = build();
    const res = await svc.archive('e1', '  O‘z xohishi bilan ');
    expect(calls['deviceToken.deleteMany'][0]).toEqual({ where: { employeeId: 'e1' } });
    expect(calls['employee.update'][0]).toMatchObject({
      where: { id: 'e1' },
      data: { isActive: false, archiveReason: 'O‘z xohishi bilan' },
    });
    expect(calls['refreshToken.updateMany'][0]).toMatchObject({ where: { employeeId: 'e1', revoked: false } });
    expect(calls['application.updateMany'][0]).toMatchObject({
      where: { assignedEmployeeId: 'e1', status: { in: [ApplicationStatus.NEW, ApplicationStatus.IN_PROGRESS] } },
      data: { assignedEmployeeId: null, status: ApplicationStatus.NEW },
    });
    expect(res.releasedMurojaats).toBe(2);
  });

  it('butunlay o‘chirish faqat arxivdagi xodimga', async () => {
    await expect(build({ id: 'e1', isActive: true }).svc.purge('e1')).rejects.toThrow(/ishdan bo'shating/);
    const archived = build({ id: 'e1', isActive: false });
    await archived.svc.purge('e1');
    expect(archived.calls['employee.delete']).toHaveLength(1);
  });

  it('tiklash arxiv belgisini olib tashlaydi; yo‘q xodim — 404', async () => {
    const { svc, calls } = build({ id: 'e1', isActive: false });
    await svc.restore('e1');
    expect(calls['employee.update'][0]).toMatchObject({ data: { isActive: true, archivedAt: null, archiveReason: null } });
    await expect(build(null).svc.restore('x')).rejects.toThrow(/topilmadi/);
  });

  it('yuzni qayta o‘rnatish shablonlarni o‘chiradi', async () => {
    expect(await build().svc.resetFace('e1')).toEqual({ removed: 3 });
  });

  it("javob yozgan murojaatlar — MESSAGE hodisalaridan, har biri bir marta", async () => {
    const { svc, prisma } = build();
    await svc.murojaats('e1', { scope: 'answered' });
    const where = (prisma.application.findMany.mock.calls[0][0] as { where: { AND: unknown[] } }).where.AND[0];
    expect(where).toEqual({ id: { in: ['a1', 'a2'] } });
    expect(prisma.applicationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorEmployeeId: 'e1', type: ApplicationEventType.MESSAGE } }),
    );
  });
});

describe('hudud va ofis (nazorat)', () => {
  const loc = (
    employeeId: string,
    insideAssignedZone: boolean,
    insideOffice: boolean,
  ) => ({
    employeeId,
    hasLocation: true,
    insideAssignedZone,
    insideOffice,
    mahallaName: null,
    isStale: false,
    assignedMahallaCodes: [],
  });

  it('ofisdagi xodim "tashqarida" hisoblanmaydi; qatorda insideOffice bor', async () => {
    const ids = ['zone', 'office', 'out'];
    const prisma = {
      faceTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
      bonus: { groupBy: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const attendance = { today: jest.fn().mockResolvedValue({ roster: [] }) };
    const locations = {
      getLatestForAll: jest
        .fn()
        .mockResolvedValue([
          loc('zone', true, false),
          loc('office', false, true),
          loc('out', false, false),
        ]),
    };
    const salaries = {
      monthlyRoster: jest.fn().mockResolvedValue({
        year: 2026,
        month: 11,
        totalNet: 0,
        rows: ids.map((employeeId) => ({ employeeId, salary: null })),
      }),
    };
    const svc = new OversightService(
      prisma as never,
      attendance as never,
      locations as never,
      salaries as never,
    );
    const res = await svc.overview();
    expect(res.summary.outsideZone).toBe(1);
    expect(res.rows.map((r) => r.location.insideOffice)).toEqual([false, true, false]);
  });

  it('tahrirlash: qayta hisobdan keyin xodimga xabar; hudud yuborilmasa — yo‘q', async () => {
    const prisma = {
      employee: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'e1', assignedMahallaCodes: ['M1'] }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const locations = {
      normalizeMahallaCodes: jest.fn((codes: string[]) => Promise.resolve(codes)),
      reevaluateTerritory: jest.fn().mockResolvedValue({}),
      territoryChanged: jest.fn().mockResolvedValue(true),
    };
    const svc = new OversightService(
      prisma as never,
      {} as never,
      locations as never,
      {} as never,
    );
    const base = { fullName: 'Aliyev Ali', position: 'Inspektor' };
    await svc.updateEmployee('e1', { ...base, officeLat: 41.3, officeLng: 69.3 });
    expect(locations.reevaluateTerritory).toHaveBeenCalledTimes(1);
    expect(locations.territoryChanged).not.toHaveBeenCalled();

    await svc.updateEmployee('e1', { ...base, assignedMahallaCodes: [] });
    expect(prisma.employee.update.mock.calls[1][0].data.assignedMahallaCodes).toEqual([]);
    expect(locations.territoryChanged).toHaveBeenCalledWith('e1', ['M1'], []);
  });
});
