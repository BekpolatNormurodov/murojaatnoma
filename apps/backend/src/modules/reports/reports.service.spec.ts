import { AttendanceType } from '@prisma/client';
import { isAllowedUpload } from '../applications/applications.module';
import { ReportsService } from './reports.service';

const BASE = 'https://murojaatnoma.uz';

function localDay(offsetDays = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function build(over: Record<string, unknown> = {}) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    dailyReport: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ id: 'r1', createdAt: new Date(), ...data });
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
    },
    employee: {
      findUnique: jest.fn().mockResolvedValue({ id: 'e1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    employeeLocation: { findMany: jest.fn().mockResolvedValue([]) },
    attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    zone: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    ...over,
  };
  const config = { get: jest.fn(() => ({ publicBaseUrl: BASE })) };
  return { svc: new ReportsService(prisma as never, config as never), prisma, created };
}

describe('kunlik hisobot', () => {
  it('matn yoki fayl bo‘lishi shart; bo‘sh hisobot rad etiladi', async () => {
    const { svc } = build();
    await expect(svc.create('e1', { text: '   ' })).rejects.toThrow(/bo'sh/);
  });

  it('bugungi kun bilan saqlanadi, fayllar faqat bizning /uploads dan', async () => {
    const { svc, created } = build();
    const res = await svc.create('e1', {
      text: ' Olmazorda 12 xonadon ',
      attachments: [{ kind: 'voice', url: `${BASE}/uploads/a1.m4a`, durationSec: 42 }],
    });
    expect(created[0]).toMatchObject({ employeeId: 'e1', day: localDay(), text: 'Olmazorda 12 xonadon' });
    expect(res.attachments).toEqual([
      { kind: 'voice', url: `${BASE}/uploads/a1.m4a`, fileName: null, fileSize: null, durationSec: 42 },
    ]);
    await expect(
      svc.create('e1', { attachments: [{ kind: 'file', url: 'https://evil.example/x.pdf' }] }),
    ).rejects.toThrow(/Fayl manzili/);
  });

  it('kelajak va 7 kundan eski sana rad etiladi; kecha — mumkin', async () => {
    const { svc, created } = build();
    await expect(svc.create('e1', { text: 'x', day: localDay(1) })).rejects.toThrow(/Kelajak/);
    await expect(svc.create('e1', { text: 'x', day: localDay(-8) })).rejects.toThrow(/7 kun/);
    await expect(svc.create('e1', { text: 'x', day: '2026-02-31' })).rejects.toThrow(/noto'g'ri/);
    await svc.create('e1', { text: 'x', day: localDay(-1) });
    expect(created[0].day).toBe(localDay(-1));
  });

  it('o‘chirish: faqat o‘ziniki va faqat yuborilgan kuni', async () => {
    const yesterday = new Date(Date.now() - 86_400_000 * 2);
    const mk = (row: unknown) =>
      build({
        dailyReport: {
          findUnique: jest.fn().mockResolvedValue(row),
          delete: jest.fn().mockResolvedValue({}),
        },
      });
    await expect(mk({ id: 'r', employeeId: 'other', createdAt: new Date() }).svc.removeMine('e1', 'r')).rejects.toThrow(
      /topilmadi/,
    );
    await expect(mk({ id: 'r', employeeId: 'e1', createdAt: yesterday }).svc.removeMine('e1', 'r')).rejects.toThrow(
      /yuborilgan kuni/,
    );
    const ok = mk({ id: 'r', employeeId: 'e1', createdAt: new Date() });
    await ok.svc.removeMine('e1', 'r');
    expect(ok.prisma.dailyReport.delete).toHaveBeenCalledWith({ where: { id: 'r' } });
  });
});

describe('hudud vaqti va faollik', () => {
  it('zoneTime: so‘ralgan har bir kun qaytadi (bo‘sh kunlar ham), yangi kun birinchi', async () => {
    const t = (h: number, m: number) => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    const { svc } = build({
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'e1' }) },
      employeeLocation: {
        findMany: jest.fn().mockResolvedValue([
          { recordedAt: t(0, 10), insideAssignedZone: true, mahallaName: 'Olmazor' },
          { recordedAt: t(0, 20), insideAssignedZone: true, mahallaName: 'Olmazor' },
        ]),
      },
    });
    const res = await svc.zoneTime('e1', 7);
    expect(res.days).toHaveLength(7);
    expect(res.days[0]).toMatchObject({ date: localDay(), zoneMinutes: 10 });
    expect(res.days[6]).toMatchObject({ date: localDay(-6), zoneMinutes: 0, stretches: [], byMahalla: [] });
    expect(res.days[0].byMahalla).toEqual([{ name: 'Olmazor', inside: true, minutes: 10 }]);
  });

  it('zoneTime: yo‘q xodim — 404', async () => {
    const { svc } = build({ employee: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc.zoneTime('x')).rejects.toThrow(/topilmadi/);
  });

  it('activity: mahalla nomlari, hisobot kunlari, hudud/faol va ish vaqti bitta qatorda', async () => {
    const d = (h: number) => {
      const x = new Date();
      x.setHours(h, 0, 0, 0);
      return x;
    };
    const { svc } = build({
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            fullName: 'Aliyev Ali',
            position: 'Inspektor',
            avatarUrl: null,
            assignedMahallaCodes: ['M2', 'M1'],
            workStartTime: '09:00',
            workEndTime: '18:00',
            department: { name: 'Nazorat' },
          },
        ]),
      },
      zone: {
        findMany: jest.fn().mockResolvedValue([
          { code: 'M1', nameUzLat: 'Olmazor' },
          { code: 'M2', nameUzLat: 'Buyuk ipak' },
        ]),
      },
      dailyReport: {
        findMany: jest.fn().mockResolvedValue([
          { employeeId: 'e1', day: localDay() },
          { employeeId: 'e1', day: localDay() },
          { employeeId: 'e1', day: localDay(-1) },
        ]),
      },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([
          { employeeId: 'e1', type: AttendanceType.CHECK_IN, recordedAt: d(9) },
          { employeeId: 'e1', type: AttendanceType.CHECK_OUT, recordedAt: d(17) },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ employeeId: 'e1', zone_s: 7200, active_s: 9000 }]),
    });
    const res = await svc.activity({});
    expect(res.rows).toEqual([
      {
        employeeId: 'e1',
        fullName: 'Aliyev Ali',
        position: 'Inspektor',
        department: 'Nazorat',
        avatarUrl: null,
        mahallas: ['Buyuk ipak', 'Olmazor'],
        workStartTime: '09:00',
        workEndTime: '18:00',
        reportDays: 2,
        reportCount: 3,
        zoneMinutes: 120,
        activeMinutes: 150,
        workMinutes: 480,
        daysWorked: 1,
      },
    ]);
  });

  it('davr: teskari yoki juda uzun oraliq rad etiladi', async () => {
    const { svc } = build();
    await expect(svc.activity({ from: '2026-11-10', to: '2026-11-01' })).rejects.toThrow(/keyin bo'lmasin/);
    await expect(svc.list({ from: '2026-01-01', to: '2026-11-01' })).rejects.toThrow(/oshmasin/);
  });
});

describe('fayl yuklash filtri', () => {
  it('hujjatlar faqat /uploads/document orqali; media hamma joyda', () => {
    expect(isAllowedUpload('/uploads', 'image/jpeg', 'a.jpg')).toBe(true);
    expect(isAllowedUpload('/uploads', 'application/pdf', 'a.pdf')).toBe(false);
    expect(isAllowedUpload('/uploads/document', 'application/pdf', 'a.pdf')).toBe(true);
    expect(isAllowedUpload('/api/uploads/document', 'application/octet-stream', 'Hisobot.DOCX')).toBe(true);
    expect(isAllowedUpload('/uploads/document', 'application/x-msdownload', 'virus.exe')).toBe(false);
  });
});
