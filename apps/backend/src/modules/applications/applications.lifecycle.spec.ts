import { ApplicationKind, ApplicationStatus, Priority } from '@prisma/client';
import { ApplicationsService, MAX_REOPENS, REOPEN_WINDOW_DAYS } from './applications.service';

const H = 3_600_000;
const citizen = { role: 'CITIZEN', phone: '+998901234567' } as never;

function app(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    applicantFullName: 'Aliyeva Nodira',
    applicantPhone: '+998901234567',
    subject: "[ARIZA|Kommunal] Ko'cha chirog'i",
    description: 'Bir haftadan beri yonmayapti',
    status: ApplicationStatus.NEW,
    assignedEmployeeId: null,
    priority: Priority.medium,
    kind: ApplicationKind.ARIZA,
    reopenCount: 0,
    resolvedAt: null,
    dueAt: new Date(Date.now() + 100 * H),
    escalatedAt: null,
    ...over,
  };
}

function build(row: Record<string, unknown> | null = app(), opts: { staffMessages?: number } = {}) {
  const writes: { op: string; data: Record<string, unknown> }[] = [];
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        writes.push({ op: 'create', data });
        return Promise.resolve({ id: 'new1', status: ApplicationStatus.NEW, ...data });
      }),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        writes.push({ op: 'update', data });
        return Promise.resolve({ ...row, ...data });
      }),
    },
    applicationEvent: { create: jest.fn(({ data }) => (writes.push({ op: 'event', data }), Promise.resolve(data))) },
    applicationMessage: {
      create: jest.fn(({ data }) => (writes.push({ op: 'message', data }), Promise.resolve(data))),
      count: jest.fn().mockResolvedValue(opts.staffMessages ?? 0),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
    employee: { findUnique: jest.fn().mockResolvedValue({ fullName: 'Gulnora Yusupova' }) },
    citizenFace: {
      findUnique: jest.fn().mockResolvedValue({ phone: '+998901234567', photoUrl: 'https://x/uploads/face-1.jpg' }),
    },
  };
  (prisma as Record<string, unknown>).$transaction = (fn: (tx: unknown) => unknown) => fn(prisma);
  const notify = { admin: jest.fn(), citizen: jest.fn(), employee: jest.fn() };
  const push = { sendToEmployee: jest.fn().mockResolvedValue(undefined) };
  const service = new ApplicationsService(prisma as never, push as never, notify as never);
  return { service, prisma, notify, writes };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('murojaat lifecycle rules', () => {
  it('a shikoyat gets the stricter SLA and everyone is told', async () => {
    const { service, writes, notify } = build();
    const before = Date.now();
    await service.create({
      applicantFullName: 'Aliyeva Nodira',
      applicantPhone: '+998901234567',
      subject: '[SHIKOYAT|Kommunal] Suv yo‘q',
      description: 'Uch kundan beri suv kelmayapti',
    });
    const created = writes.find((w) => w.op === 'create')!.data;
    expect(created.kind).toBe(ApplicationKind.SHIKOYAT);
    expect(created.category).toBe('Kommunal');
    const dueH = ((created.dueAt as Date).getTime() - before) / H;
    expect(Math.round(dueH)).toBe(72); // medium shikoyat = 3 days (ariza would be 5)
    await flush();
    expect(notify.admin).toHaveBeenCalledWith(expect.objectContaining({ title: 'Yangi shikoyat' }));
    expect(notify.citizen).toHaveBeenCalledWith('+998901234567', 'Shikoyatingiz qabul qilindi', expect.stringContaining('3 kun'), 'new1');
  });

  it("stamps the murojaat with the citizen's own enrolled face only", async () => {
    const base = {
      applicantFullName: 'Aliyeva Nodira',
      applicantPhone: '+998901234567',
      subject: '[ARIZA|Kommunal] Chiroq',
      description: 'Ko‘cha chirog‘i yonmayapti',
    };
    const own = build();
    await own.service.create({ ...base, applicantPhotoUrl: 'https://x/uploads/face-1.jpg' });
    expect(own.writes.find((w) => w.op === 'create')!.data.applicantPhotoUrl).toBe('https://x/uploads/face-1.jpg');

    const borrowed = build();
    await borrowed.service.create({ ...base, applicantPhotoUrl: 'https://x/uploads/someone-else.jpg' });
    expect(borrowed.writes.find((w) => w.op === 'create')!.data.applicantPhotoUrl).toBeNull();
  });

  it('cannot move to IN_PROGRESS without an assignee', async () => {
    const { service } = build();
    await expect(service.updateStatus('a1', { status: ApplicationStatus.IN_PROGRESS })).rejects.toThrow(
      /xodimga biriktiring/,
    );
  });

  it('rejecting needs a reason; the reason reaches the citizen thread and inbox', async () => {
    const { service, writes, notify } = build();
    await expect(service.updateStatus('a1', { status: ApplicationStatus.REJECTED })).rejects.toThrow(/sababini/);
    await service.updateStatus('a1', { status: ApplicationStatus.REJECTED, note: 'Bu tuman vakolatida emas' });
    expect(writes.find((w) => w.op === 'message')!.data.text).toBe('Murojaat rad etildi. Sabab: Bu tuman vakolatida emas');
    await flush();
    expect(notify.citizen).toHaveBeenCalledWith(
      '+998901234567',
      'Murojaatingiz rad etildi',
      expect.stringContaining('vakolatida'),
      'a1',
    );
  });

  it('resolving needs an answer unless staff already replied', async () => {
    const inWork = app({ status: ApplicationStatus.IN_PROGRESS, assignedEmployeeId: 'e1' });
    await expect(build(inWork).service.updateStatus('a1', { status: ApplicationStatus.RESOLVED })).rejects.toThrow(
      /javob yozing/,
    );
    const { service, notify } = build(inWork, { staffMessages: 1 });
    await service.updateStatus('a1', { status: ApplicationStatus.RESOLVED });
    await flush();
    expect(notify.citizen).toHaveBeenCalledWith('+998901234567', 'Murojaatingiz hal qilindi', expect.any(String), 'a1');
  });

  it(`reopen: only within ${REOPEN_WINDOW_DAYS} days and at most ${MAX_REOPENS} times`, async () => {
    const old = app({ status: ApplicationStatus.RESOLVED, resolvedAt: new Date(Date.now() - 8 * 24 * H) });
    await expect(build(old).service.reopen('a1', citizen, 'hal bo‘lmadi')).rejects.toThrow(/7 kundan/);

    const tired = app({ status: ApplicationStatus.RESOLVED, resolvedAt: new Date(), reopenCount: MAX_REOPENS });
    const t = build(tired);
    await expect(t.service.reopen('a1', citizen, 'yana hal bo‘lmadi')).rejects.toThrow(/2 marta/);
    expect(t.notify.admin).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fuqaro natijadan norozi' }));

    const ok = build(app({ status: ApplicationStatus.RESOLVED, resolvedAt: new Date(), assignedEmployeeId: 'e1' }));
    await ok.service.reopen('a1', citizen, 'chiroq yana o‘chdi');
    const upd = ok.writes.find((w) => w.op === 'update')!.data;
    expect(upd).toMatchObject({ status: ApplicationStatus.IN_PROGRESS, reopenCount: { increment: 1 }, escalatedAt: null });
    expect(((upd.dueAt as Date).getTime() - Date.now()) / H).toBeGreaterThan(23); // fresh deadline
    expect(ok.notify.employee).toHaveBeenCalled();
  });

  it('a low rating alerts the admins', async () => {
    const { service, notify } = build(app({ status: ApplicationStatus.RESOLVED, resolvedAt: new Date() }));
    await service.rate('a1', citizen, 2, 'yomon');
    expect(notify.admin).toHaveBeenCalledWith(expect.objectContaining({ title: 'Past baho: 2/5' }));
  });

  it('overdue murojaats are escalated once', async () => {
    const { service, prisma, notify, writes } = build();
    prisma.application.findMany.mockResolvedValueOnce([
      { ...app(), kind: ApplicationKind.SHIKOYAT, assignedEmployeeId: 'e1', assignedEmployee: { fullName: 'Ali' } },
    ]);
    expect(await service.escalateOverdue()).toBe(1);
    expect(writes.find((w) => w.op === 'update')!.data.escalatedAt).toBeInstanceOf(Date);
    expect(notify.admin).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shikoyat muddati o‘tdi' }));
    expect(notify.employee).toHaveBeenCalledWith('e1', 'Murojaat muddati o‘tdi', expect.any(String), expect.any(Object));
  });
});
