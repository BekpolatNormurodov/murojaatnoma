import { AttendanceType, PrismaClient } from '@prisma/client';
import { ReportsService } from './reports.service';
import { ZONE_GAP_MS, zoneDays } from './zone-time';

/**
 * The SQL pass (`zoneSecondsByDay`) and `zoneDays` must give the same figures.
 * Needs a real Postgres, so it runs only when pointed at a local throw-away one
 * that has the schema:
 *
 *   DATABASE_URL=$URL npx prisma db push --skip-generate
 *   ZONE_PARITY_DATABASE_URL=$URL npx jest zone-time.parity
 */
const url = process.env.ZONE_PARITY_DATABASE_URL ?? '';
const run = /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? describe : describe.skip;

const SCHEDULES = [
  ['09:00', '18:00'],
  ['08:30', '17:45'],
  ['00:00', '00:00'], // end <= start: the whole day
  ['20:00', '08:00'],
  ['soat 9', '13:15'], // unreadable start = midnight
  ['9:05', '23:59'],
];

const localDay = (d: Date) => d.toLocaleDateString('sv-SE');

/** Small seeded generator — the same data on every run. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

run('hudud vaqti: SQL va zoneDays bir xil (haqiqiy Postgres)', () => {
  let prisma: PrismaClient;
  let svc: ReportsService;
  const ids = SCHEDULES.map((_, i) => `parity-${process.pid}-${i}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - 7 * 86_400_000);
  const to = new Date(today.getTime() + 86_400_000 - 1);

  beforeAll(async () => {
    // The JS side buckets by the process's local day; the SQL side by Tashkent's.
    expect(today.getTimezoneOffset()).toBe(-300);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    svc = new ReportsService(
      prisma as never,
      { get: () => ({ workDays: [1, 2, 3, 4, 5] }) } as never,
    );
    const rnd = random(20261125);
    const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];

    for (const [i, id] of ids.entries()) {
      const [workStartTime, workEndTime] = SCHEDULES[i];
      await prisma.employee.create({
        data: {
          id,
          fullName: `Parity ${i}`,
          phone: id,
          position: 'test',
          region: 'test',
          district: 'test',
          workStartTime,
          workEndTime,
        },
      });
      const fixes = [];
      // One stretch across each edge of the window, then random data.
      const edges = [from.getTime(), to.getTime() + 1].flatMap((midnight) =>
        [-4, 6].map((min) => ({
          employeeId: id,
          latitude: 41.3,
          longitude: 69.3,
          recordedAt: new Date(midnight + min * 60_000),
          insideAssignedZone: true,
          insideOffice: false,
          mahallaName: null,
          accuracy: null,
        })),
      );
      await prisma.employeeLocation.createMany({ data: edges });
      let at = from.getTime() - 20 * 60_000;
      while (at < to.getTime() + 20 * 60_000) {
        const inside = rnd() < 0.5;
        fixes.push({
          employeeId: id,
          latitude: 41.3,
          longitude: 69.3,
          recordedAt: new Date(at),
          insideAssignedZone: inside,
          insideOffice: rnd() < 0.4,
          mahallaName: pick(['Olmazor', 'Buyuk ipak', null]),
          accuracy: pick([null, 5, 40, 149.9, 150, 150.1, 900]),
        });
        const r = rnd();
        // Ties, exact 15-minute gaps, long silences, and ordinary steps.
        at +=
          r < 0.02
            ? 0
            : r < 0.05
              ? 15 * 60_000
              : r < 0.08
                ? 15 * 60_000 + 1
                : r < 0.12
                  ? Math.floor(rnd() * 5 * 3_600_000)
                  : Math.floor(rnd() * 12 * 60_000);
      }
      await prisma.employeeLocation.createMany({ data: fixes });
      // Check-ins on some days, so some weekends count as working days.
      for (let d = 0; d < 8; d++) {
        if (rnd() < 0.5) continue;
        await prisma.attendanceRecord.create({
          data: {
            employeeId: id,
            type: AttendanceType.CHECK_IN,
            faceScore: 0,
            latitude: 41.3,
            longitude: 69.3,
            isValid: true,
            recordedAt: new Date(from.getTime() + d * 86_400_000 + 9 * 3_600_000),
          },
        });
      }
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  const FIGURES = [
    'zoneMinutes',
    'officeMinutes',
    'activeMinutes',
    'workZoneMinutes',
    'workActiveMinutes',
  ] as const;

  const secondsByDay = (s: ReportsService, f: Date = from, t: Date = to) =>
    (
      s as unknown as {
        zoneSecondsByDay: (
          f: Date,
          t: Date,
        ) => Promise<Record<string, string | number>[]>;
      }
    ).zoneSecondsByDay(f, t);

  it('har bir xodim-kun: har bir bo‘lak bir xil', async () => {
    const sql = await secondsByDay(svc);
    let compared = 0;
    for (const id of ids) {
      const fixes = await prisma.employeeLocation.findMany({
        where: {
          employeeId: id,
          recordedAt: {
            gte: new Date(from.getTime() - ZONE_GAP_MS),
            lte: new Date(to.getTime() + ZONE_GAP_MS),
          },
        },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      });
      const employee = await prisma.employee.findUniqueOrThrow({ where: { id } });
      const days = zoneDays(fixes, {
        startTime: employee.workStartTime,
        endTime: employee.workEndTime,
        counts: () => true,
      }).filter((d) => d.date >= localDay(from) && d.date <= localDay(to));
      const rows = sql.filter((r) => r.employeeId === id);
      expect(rows.map((r) => r.day).sort()).toEqual(
        days.filter((d) => d.stretches.length > 0).map((d) => d.date),
      );
      for (const row of rows) {
        const day = days.find((d) => d.date === row.day)!;
        const m = (key: string) =>
          Math.round(Math.round(Number(row[key]) * 1000) / 60_000);
        expect({
          date: day.date,
          zoneMinutes: m('zone_s'),
          officeMinutes: m('office_s'),
          outsideMinutes: m('outside_s'),
          workZoneMinutes: m('work_zone_s'),
          workActiveMinutes: m('work_zone_s') + m('work_office_s') + m('work_outside_s'),
        }).toEqual({
          date: day.date,
          zoneMinutes: day.zoneMinutes,
          officeMinutes: day.officeMinutes,
          outsideMinutes: day.outsideMinutes,
          workZoneMinutes: day.workZoneMinutes,
          workActiveMinutes: day.workActiveMinutes,
        });
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(30);
  });

  it('baza vaqt mintaqasi natijaga ta’sir qilmaydi', async () => {
    const sorted = async (zone: string) => {
      const other = new URL(url);
      other.searchParams.set('options', `-c TimeZone=${zone}`);
      const client = new PrismaClient({
        datasources: { db: { url: other.toString().replace(/\+/g, '%20') } },
      });
      try {
        const [{ tz }] = await client.$queryRaw<{ tz: string }[]>`
          SELECT current_setting('TimeZone') AS tz`;
        expect(tz).toBe(zone);
        const rows = await secondsByDay(new ReportsService(client as never, {} as never));
        return rows
          .filter((r) => ids.includes(String(r.employeeId)))
          .sort((a, b) =>
            `${a.employeeId}${a.day}`.localeCompare(`${b.employeeId}${b.day}`),
          );
      } finally {
        await client.$disconnect();
      }
    };
    expect(await sorted('Asia/Tashkent')).toEqual(await sorted('UTC'));
  });

  it('kun raqamlari so‘ralgan davrga bog‘liq emas', async () => {
    const day = new Date(today.getTime() - 3 * 86_400_000);
    const end = new Date(day.getTime() + 86_400_000 - 1);
    const key = (r: Record<string, string | number>) => `${r.employeeId}|${r.day}`;
    const alone = await secondsByDay(svc, day, end);
    const wide = new Map((await secondsByDay(svc)).map((r) => [key(r), r]));
    expect(alone.length).toBeGreaterThan(0);
    for (const row of alone) expect(row).toEqual(wide.get(key(row)));
    const q = { from: localDay(day), to: localDay(day) };
    const [one, many] = await Promise.all([svc.activityDaily(q), svc.activityDaily({})]);
    for (const id of ids) {
      const a = one.rows.find((r) => r.employeeId === id)!.days[0];
      const b = many.rows
        .find((r) => r.employeeId === id)!
        .days.find((d) => d.date === q.from);
      expect(a).toEqual(b);
    }
  });

  it('activity yig‘indisi = activity/daily kunlari yig‘indisi', async () => {
    const [period, daily] = await Promise.all([svc.activity({}), svc.activityDaily({})]);
    for (const id of ids) {
      const total = period.rows.find((r) => r.employeeId === id)!;
      const row = daily.rows.find((r) => r.employeeId === id)!;
      const sum = (key: (typeof FIGURES)[number] | 'workMinutes') =>
        row.days.reduce((s, d) => s + d[key], 0);
      for (const key of FIGURES) {
        expect([id, key, total[key]]).toEqual([id, key, sum(key)]);
      }
      expect(total.workMinutes).toBe(sum('workMinutes'));
      expect(total.zoneMinutes).toBeGreaterThan(0);
    }
  });
});
