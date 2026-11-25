import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceType } from '@prisma/client';
import { isAllowedUpload, storedExtension } from '../../common/upload/upload-policy';
import { ListReportsQueryDto } from './dto';
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
  const config = {
    get: jest.fn((key: string) =>
      key === 'work' ? { workDays: [0, 1, 2, 3, 4, 5, 6] } : { publicBaseUrl: BASE },
    ),
  };
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

/** Today at h:m, `offset` days away. */
const clock = (h: number, m = 0, offset = 0): Date => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};
const gps = (recordedAt: Date, over: Record<string, unknown> = {}) => ({
  recordedAt,
  insideAssignedZone: true,
  insideOffice: false,
  mahallaName: 'Olmazor',
  accuracy: 10,
  ...over,
});
const person = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  fullName: 'Aliyev Ali',
  position: 'Inspektor',
  avatarUrl: null,
  isActive: true,
  assignedMahallaCodes: ['M2', 'M1'],
  workStartTime: '09:00',
  workEndTime: '18:00',
  department: { name: 'Nazorat' },
  ...over,
});

describe('hudud vaqti va faollik', () => {
  it('zoneTime: so‘ralgan har bir kun qaytadi (bo‘sh kunlar ham), yangi kun birinchi', async () => {
    const findMany = jest.fn().mockResolvedValue([
      // The database returns newest first.
      gps(clock(0, 20)),
      gps(clock(0, 10)),
    ]);
    const { svc } = build({
      employee: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'e1', workStartTime: '00:00', workEndTime: '00:15' }),
      },
      employeeLocation: { findMany },
    });
    const res = await svc.zoneTime('e1', 7);
    expect(res).toMatchObject({
      gapMinutes: 15,
      workStartTime: '00:00',
      workEndTime: '00:15',
    });
    expect(res.days).toHaveLength(7);
    expect(res.days[0]).toMatchObject({
      date: localDay(),
      zoneMinutes: 10,
      activeMinutes: 10,
      // Not checked in, but every weekday is a working day in this config.
      workZoneMinutes: 5,
    });
    expect(res.days[6]).toMatchObject({
      date: localDay(-6),
      zoneMinutes: 0,
      officeMinutes: 0,
      workActiveMinutes: 0,
      stretches: [],
      byMahalla: [],
    });
    expect(res.days[0].byMahalla).toEqual([
      { name: 'Olmazor', inside: true, office: false, minutes: 10 },
    ]);
    // Newest first with a cap per day, so today is never the part that is cut off.
    expect(findMany.mock.calls[0][0]).toMatchObject({
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: 7 * 6000,
      select: { insideOffice: true, accuracy: true },
    });
    expect((await svc.zoneTime('e1')).days).toHaveLength(8);
  });

  it('zoneTime: yo‘q xodim — 404', async () => {
    const { svc } = build({ employee: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc.zoneTime('x')).rejects.toThrow(/topilmadi/);
  });

  it('activity: mahalla nomlari, hisobot kunlari, hudud/faol va ish vaqti bitta qatorda', async () => {
    const findEmployees = jest
      .fn()
      .mockResolvedValue([person(), person({ id: 'e2', isActive: false })]);
    const { svc } = build({
      employee: { findMany: findEmployees },
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
          // Two days ago: came, never checked out.
          {
            employeeId: 'e1',
            type: AttendanceType.CHECK_IN,
            recordedAt: clock(9, 0, -2),
          },
          { employeeId: 'e1', type: AttendanceType.CHECK_IN, recordedAt: clock(9) },
          { employeeId: 'e1', type: AttendanceType.CHECK_OUT, recordedAt: clock(17) },
          // Today without a check-out is not "missing" yet.
          { employeeId: 'e2', type: AttendanceType.CHECK_IN, recordedAt: clock(0, 1) },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          employeeId: 'e1',
          day: localDay(),
          zone_s: 7200,
          office_s: 600,
          outside_s: 1200,
          work_zone_s: 3600,
          work_office_s: 600,
          work_outside_s: 0,
        },
      ]),
    });
    const res = await svc.activity({});
    expect(res.from).toBe(localDay(-7));
    expect(res.to).toBe(localDay());
    expect(res.rows[0]).toEqual({
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
      daysWorked: 2,
      officeMinutes: 10,
      workZoneMinutes: 60,
      workActiveMinutes: 70,
      missingCheckOutDays: 1,
      archived: false,
    });
    expect(res.rows[1]).toMatchObject({
      archived: true,
      missingCheckOutDays: 0,
      zoneMinutes: 0,
    });
    const where = findEmployees.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({ isActive: true });
    expect(where.OR[1].archivedAt.gte).toEqual(clock(0, 0, -7));
  });

  it('activity/daily: har bir xodim × har bir kun, eski kun birinchi', async () => {
    const findFixes = jest
      .fn()
      .mockResolvedValue([gps(clock(9, 10, -1)), gps(clock(9, 0, -1))]);
    const { svc } = build({
      employee: { findMany: jest.fn().mockResolvedValue([person()]) },
      employeeLocation: { findMany: findFixes },
      dailyReport: {
        findMany: jest.fn().mockResolvedValue([{ employeeId: 'e1', day: localDay(-1) }]),
      },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            employeeId: 'e1',
            type: AttendanceType.CHECK_IN,
            recordedAt: clock(9, 0, -1),
          },
          {
            employeeId: 'e1',
            type: AttendanceType.CHECK_OUT,
            recordedAt: clock(18, 0, -1),
          },
        ]),
      },
    });
    const res = await svc.activityDaily({ employeeId: 'e1' });
    expect(res).toMatchObject({ from: localDay(-7), to: localDay(), gapMinutes: 15 });
    expect(findFixes).toHaveBeenCalledTimes(1);
    const [row] = res.rows;
    expect(row).toMatchObject({
      employeeId: 'e1',
      department: 'Nazorat',
      archived: false,
    });
    expect(row.days.map((d) => d.date)).toEqual(
      [-7, -6, -5, -4, -3, -2, -1, 0].map((n) => localDay(n)),
    );
    expect(row.days[6]).toEqual({
      date: localDay(-1),
      checkInAt: clock(9, 0, -1),
      checkOutAt: clock(18, 0, -1),
      workMinutes: 540,
      reportCount: 1,
      zoneMinutes: 10,
      officeMinutes: 0,
      outsideMinutes: 0,
      activeMinutes: 10,
      workZoneMinutes: 10,
      workActiveMinutes: 10,
      firstAt: clock(9, 0, -1),
      lastAt: clock(9, 10, -1),
      stretches: [
        {
          from: clock(9, 0, -1),
          to: clock(9, 10, -1),
          minutes: 10,
          inside: true,
          office: false,
          mahallaName: 'Olmazor',
        },
      ],
    });
    expect(row.days[0]).toMatchObject({ checkInAt: null, reportCount: 0, stretches: [] });
  });

  it('activity/daily: ko‘pi bilan 31 kun', async () => {
    const { svc } = build();
    await expect(
      svc.activityDaily({ from: '2026-10-01', to: '2026-10-31' }),
    ).resolves.toMatchObject({ rows: [] });
    for (const from of ['2026-09-30', '2026-01-01']) {
      await expect(svc.activityDaily({ from, to: '2026-10-31' })).rejects.toThrow(
        'Davr 31 kundan oshmasin',
      );
    }
  });

  it('davr: teskari yoki juda uzun oraliq rad etiladi', async () => {
    const { svc } = build();
    await expect(svc.activity({ from: '2026-11-10', to: '2026-11-01' })).rejects.toThrow(/keyin bo'lmasin/);
    await expect(svc.list({ from: '2026-01-01', to: '2026-11-01' })).rejects.toThrow(
      /Davr 92 kundan oshmasin/,
    );
  });

  it('ro‘yxat: default 8 kun va 1000 ta; limit/offset bilan sahifalanadi', async () => {
    const { svc, prisma } = build();
    await svc.list({});
    expect(prisma.dailyReport.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { day: { gte: localDay(-7), lte: localDay() } },
        orderBy: [{ day: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 1000,
        skip: 0,
      }),
    );
    await svc.list({ limit: 50, offset: 100 });
    expect(prisma.dailyReport.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 50, skip: 100 }),
    );
  });

  it('ro‘yxat parametrlari: limit 1..2000, offset >= 0', () => {
    const errors = (query: Record<string, string>) =>
      validateSync(plainToInstance(ListReportsQueryDto, query), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).map((e) => e.property);
    expect(errors({ limit: '2000', offset: '0', from: '2026-11-01' })).toEqual([]);
    expect(errors({ limit: '0' })).toEqual(['limit']);
    expect(errors({ limit: '2001' })).toEqual(['limit']);
    expect(errors({ offset: '-1' })).toEqual(['offset']);
    expect(errors({ page: '2' })).toEqual(['page']);
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

  it('kengaytma faqat ro‘yxatdan: svg/html/xml media deb yuborilsa ham rad etiladi', () => {
    for (const name of [
      'a.svg',
      'a.html',
      'a.HTM',
      'a.xml',
      'a.xhtml',
      'a.js',
      'a.jpg.html',
    ]) {
      expect(isAllowedUpload('/uploads', 'image/png', name)).toBe(false);
      expect(isAllowedUpload('/uploads/document', 'image/png', name)).toBe(false);
    }
    expect(isAllowedUpload('/uploads', 'image/svg+xml', 'rasm')).toBe(false);
    expect(isAllowedUpload('/uploads', 'text/html', 'a.jpg')).toBe(false);
    expect(storedExtension('/uploads', 'video/quicktime', 'IMG_1.MOV')).toBe('mov');
    // No extension in the name: taken from the mimetype.
    expect(storedExtension('/uploads', 'audio/mp4', 'blob')).toBe('m4a');
    expect(storedExtension('/uploads', 'image/jpeg', '.jpg')).toBe('jpg');
    expect(storedExtension('/uploads/document', 'application/pdf', 'hisobot')).toBe(
      'pdf',
    );
    expect(storedExtension('/uploads', 'application/pdf', 'hisobot')).toBeNull();
  });

  it('hujjat yo‘li faqat URL yo‘lidan aniqlanadi (query bilan aldab bo‘lmaydi)', () => {
    expect(
      isAllowedUpload(
        '/applications/face?x=/uploads/document',
        'application/pdf',
        'a.pdf',
      ),
    ).toBe(false);
    expect(isAllowedUpload('/uploads/document/?a=1', 'application/pdf', 'a.pdf')).toBe(
      true,
    );
  });
});
