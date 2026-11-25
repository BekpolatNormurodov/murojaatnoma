import assert from 'node:assert/strict';
import { test } from 'node:test';
import XLSX from 'xlsx';
import { buildActivityReport, type ActivityReportInput } from '../src/features/oversight/activitySheets.ts';
import { buildWorkbook, MAX_COLUMN_WIDTH } from '../src/shared/lib/export.ts';

process.env.TZ = 'Asia/Tashkent';
const TODAY = '2026-11-25';
const longName = 'Abdurahmonov Abdulaziz Abdurashid oʻgʻli';

const person = (employeeId: string, fullName: string, extra = {}) => ({
  employeeId,
  fullName,
  position: 'Mutaxassis',
  department: null,
  avatarUrl: null,
  mahallas: ['Olmazor', 'Navroʻz'],
  workStartTime: '09:00',
  workEndTime: '18:00',
  reportDays: 2,
  reportCount: 3,
  zoneMinutes: 1500,
  officeMinutes: 61,
  activeMinutes: 1600,
  workZoneMinutes: 400,
  workActiveMinutes: 450,
  workMinutes: 540,
  daysWorked: 1,
  missingCheckOutDays: 1,
  archived: false,
  ...extra,
});

const oversightRow = (employeeId: string, fullName: string, status: 'absent' | 'present') => ({
  employeeId,
  fullName,
  position: 'Mutaxassis',
  avatarUrl: null,
  username: null,
  phone: '',
  hasFace: false,
  attendance: { status, checkInAt: null, checkOutAt: null, isLate: false, hoursWorked: 1.5, monthHours: 0 },
  location: { hasLocation: true, insideAssignedZone: false, insideOffice: true, mahallaName: null, isStale: false },
  assignedMahallaCodes: [],
  salaryNet: 100,
  salaryBase: 100,
  premyaThisMonth: 0,
});

function input(over: Partial<ActivityReportInput> = {}): ActivityReportInput {
  const people = [person('a', longName), person('b', 'Boboyev Bek'), person('z', 'Zokirov Zafar', { archived: true })];
  return {
    range: { from: '2026-11-18', to: TODAY },
    today: TODAY,
    activity: { from: '2026-11-18', to: TODAY, rows: people },
    daily: {
      from: '2026-11-18',
      to: TODAY,
      gapMinutes: 15,
      rows: people.map((p) => ({
        ...p,
        days: [
          {
            date: '2026-11-24',
            checkInAt: '2026-11-24T04:00:00Z',
            checkOutAt: null,
            workMinutes: 0,
            reportCount: 1,
            zoneMinutes: 10,
            officeMinutes: 5,
            outsideMinutes: 0,
            activeMinutes: 15,
            workZoneMinutes: 0,
            workActiveMinutes: 0,
            firstAt: '2026-11-24T18:50:00Z',
            lastAt: '2026-11-24T19:00:00Z',
            stretches: [
              {
                from: '2026-11-24T18:50:00Z',
                to: '2026-11-24T19:00:00Z', // Tashkent midnight
                minutes: 10,
                inside: false,
                office: true,
                mahallaName: 'Olmazor',
              },
            ],
          },
        ],
      })),
    },
    oversight: {
      year: 2026,
      month: 11,
      rows: [oversightRow('a', longName, 'absent'), oversightRow('b', 'Boboyev Bek', 'present')],
      summary: { total: 2, faceEnrolled: 0, presentNow: 1, lateNow: 0, outsideZone: 0, salaryTotalNet: 200 },
    },
    ...over,
  };
}

/** Write a real .xlsx and read it back. */
function roundTrip(i: ActivityReportInput) {
  const report = buildActivityReport(i);
  const bytes = XLSX.write(buildWorkbook(XLSX, report.sheets), { type: 'buffer', bookType: 'xlsx' });
  const wb = XLSX.read(bytes, { type: 'buffer', cellNF: true, cellStyles: true });
  const table = (name: string) => XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false });
  /** Rows of one sheet as header → shown text. */
  const records = (name: string) => {
    const rows = table(name);
    const head = rows.findIndex((r) => r.includes('F.I.Sh.'));
    return rows.slice(head + 1).map((r) => Object.fromEntries(rows[head].map((h, n) => [h, r[n]])));
  };
  return { report, wb, table, records };
}

test('all sheets, durations as real Excel time with [h]:mm', () => {
  const { wb, records, table } = roundTrip(input());
  assert.deepEqual(wb.SheetNames, ['Faollik', 'Kunlik', 'Oraliqlar', 'Bugungi holat', 'Umumiy']);
  const [first] = records('Faollik');
  assert.equal(first['F.I.Sh.'], longName);
  assert.equal(first['Mahallalari'], 'Olmazor, Navroʻz');
  assert.equal(first['Hisobot bergan kunlar'], '2');
  assert.equal(first['Hududda (24 soat)'], '25:00');
  assert.equal(first['Ofisda (24 soat)'], '1:01');
  assert.equal(first['Ishlagan vaqt (keldi–ketdi)'], '9:00');
  assert.equal(first['Ketish belgilanmagan kunlar'], '1');
  const total = records('Faollik').at(-1)!;
  assert.equal(total['№'], 'JAMI');
  assert.equal(total['Faol (24 soat)'], '80:00');
  const numeric = Object.values(wb.Sheets['Faollik']).find(
    (c) => typeof c === 'object' && c !== null && 'z' in c && (c as XLSX.CellObject).z === '[h]:mm',
  ) as XLSX.CellObject;
  assert.equal(numeric.t, 'n');
  assert.ok(table('Umumiy').some((r) => r[0] === 'Bugun: hozir ish joyida'));
  assert.equal(records('Bugungi holat')[0]['Hudud'], 'Ofisda');
  assert.equal(records('Bugungi holat')[0]['Bugun ishlagan'], '1:30');
});

test('exact from-to times; a stretch cut at midnight ends 24:00', () => {
  const { records } = roundTrip(input());
  const [s] = records('Oraliqlar');
  assert.equal(s['Dan'], '23:50');
  assert.equal(s['Gacha'], '24:00');
  assert.equal(s['Davomiyligi'], '0:10');
  assert.equal(s['Holat'], 'Ofisda');
  const [day] = records('Kunlik');
  assert.equal(day['Sana'], '24.11.2026');
  assert.equal(day['Keldi'], '09:00');
  assert.equal(day['Ketdi'], '—');
});

test('a quick filter keeps archived employees and is named in the subtitle', () => {
  const { report, records, table } = roundTrip(
    input({ filter: { flag: { label: 'Kelmagan', test: (r) => r.attendance.status === 'absent' } } }),
  );
  assert.equal(report.employees, 2);
  const names = records('Faollik').map((r) => r['F.I.Sh.']);
  assert.ok(names.includes('Zokirov Zafar'));
  assert.ok(!names.includes('Boboyev Bek'));
  assert.ok(!records('Kunlik').some((r) => r['F.I.Sh.'] === 'Boboyev Bek'));
  assert.match(table('Faollik')[1][0], /Filtr: Kelmagan.*arxivdagi 1 ta/);
});

test('a search applies to everyone and is named in the subtitle', () => {
  const { report, table } = roundTrip(input({ filter: { query: 'bobo' } }));
  assert.equal(report.employees, 1);
  assert.match(table('Faollik')[1][0], /Qidiruv: «bobo»/);
});

test('another month gets no today-only sheet or counters; long periods say why', () => {
  const { report, wb, table } = roundTrip(input({ range: { from: '2026-08-01', to: '2026-10-31' }, daily: null }));
  assert.deepEqual(wb.SheetNames, ['Faollik', 'Umumiy']);
  assert.ok(!table('Umumiy').some((r) => String(r[0]).startsWith('Bugun')));
  assert.ok(!table('Umumiy').some((r) => String(r[0]).startsWith('Oylik fondi')));
  assert.equal(report.dailyMissing, 'davr 31 kundan uzun');
});

test('fields an older server does not send stay blank, not zero', () => {
  const base = input();
  const rows = base.activity.rows.map((r) => ({
    ...r,
    officeMinutes: undefined,
    workZoneMinutes: undefined,
  }));
  const { records } = roundTrip({ ...base, daily: null, activity: { ...base.activity, rows } });
  assert.equal(records('Faollik')[0]['Ofisda (24 soat)'] ?? '', '');
  assert.equal(records('Faollik').at(-1)!['Ish vaqtida hududda'] ?? '', '');
});

test('column width follows the content and is capped', () => {
  const wb = buildWorkbook(XLSX, [
    {
      name: 'W',
      columns: [
        { header: 'A', value: () => 'x'.repeat(30) },
        { header: 'B', value: () => 'y'.repeat(200) },
        { header: 'C', value: () => 1, width: 6 },
        { header: 'D', value: () => 1 / 3, numFmt: '[h]:mm' },
      ],
      rows: [1],
    },
  ]);
  assert.deepEqual(
    wb.Sheets['W']['!cols']!.map((c) => c.wch),
    [32, MAX_COLUMN_WIDTH, 6, 12],
  );
});
