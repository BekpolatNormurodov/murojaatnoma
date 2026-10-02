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
