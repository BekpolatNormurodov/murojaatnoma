/* ============================================================
   Xodimlar faolligi — Excel varaqlari (toza funksiya: tarmoq ham, DOM ham
   yo'q). Davomiyliklar Excel vaqti sifatida yoziladi (daqiqa / 1440, "[h]:mm")
   — jadvalda qo'shsa, saralasa bo'ladi.
   ============================================================ */
import type { ExportColumn, SheetSpec } from '../../shared/lib/export.ts';
import { formatSom } from '../../shared/lib/format.ts';
import { TERRITORY_LABEL, territoryOf } from '../../shared/lib/territory.ts';
import { matchesSearch } from '../../shared/lib/translit.ts';
import { attMeta } from './oversightMeta.ts';
import { clock, daysInclusive, dmy, MAX_DAILY_DAYS, rangeText, stretchEnd, type Range } from './period.ts';
import type { Activity, ActivityDaily, ActivityDailyDay, ActivityDailyRow, ActivityRow, ZoneStretch } from './useActivity.ts';
import type { OversightData, OversightRow } from './useOversight.ts';

export const DURATION_FMT = '[h]:mm';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/** Daqiqa → Excel vaqti (kun ulushi). Server bermagan qiymat — bo'sh katak. */
export function excelDuration(minutes: number | null | undefined): number | '' {
  return minutes == null ? '' : Math.round(minutes) / 1440;
}

function durationColumn<T>(header: string, minutes: (row: T) => number | null | undefined): ExportColumn<T> {
  return {
    header,
    value: (r) => excelDuration(minutes(r)),
    numFmt: DURATION_FMT,
    align: 'right',
    total: (rs) => {
      const known = rs.map(minutes).filter((m): m is number => m != null);
      return known.length ? excelDuration(known.reduce((a, m) => a + m, 0)) : '';
    },
  };
}

function countColumn<T>(header: string, count: (row: T) => number | null | undefined): ExportColumn<T> {
  return {
    header,
    value: (r) => count(r) ?? '',
    align: 'right',
    total: (rs) => {
      const known = rs.map(count).filter((n): n is number => n != null);
      return known.length ? known.reduce((a, n) => a + n, 0) : '';
    },
  };
}

const zonesText = (mahallas: string[]) => (mahallas.length ? mahallas.join(', ') : 'Biriktirilmagan');
const statusText = (archived: boolean | undefined) => (archived ? 'Arxivda' : 'Faol');

/* ───────────── Sahifadagi filtr / qidiruv ───────────── */

export interface ExportFilter {
  query?: string;
  /** Tezkor filtr (bugungi holat bo'yicha) — faqat faol xodimlarga qo'llanadi. */
  flag?: { label: string; test: (row: OversightRow) => boolean };
}

/**
 * Filtrga mos xodimlar. Arxivdagilarning "bugungi holati" yo'q — tezkor filtr
 * ularni jimgina tushirib qoldirmaydi, faqat qidiruv qo'llanadi.
 */
export function selectEmployees<T extends { employeeId: string; fullName: string; position: string; archived?: boolean }>(
  people: T[],
  oversightRows: OversightRow[],
  filter: ExportFilter = {},
): T[] {
  const live = new Map(oversightRows.map((r) => [r.employeeId, r]));
  return people.filter((p) => {
    if (!matchesSearch(filter.query ?? '', p.fullName, p.position)) return false;
    const row = live.get(p.employeeId);
    return filter.flag && row && !p.archived ? filter.flag.test(row) : true;
  });
}

function filterText(filter: ExportFilter | undefined, archived: number): string[] {
  const out: string[] = [];
  if (filter?.flag) out.push(`Filtr: ${filter.flag.label}`);
  if (filter?.query?.trim()) out.push(`Qidiruv: «${filter.query.trim()}»`);
  if (filter?.flag && archived > 0) out.push(`arxivdagi ${archived} ta xodim filtrdan qat'i nazar kiritilgan`);
  return out;
}

/* ───────────── Varaqlar ───────────── */

function activityColumns(): ExportColumn<ActivityRow & { n: number }>[] {
  return [
    { header: '№', value: (r) => r.n, align: 'center', width: 6 },
    { header: 'F.I.Sh.', value: (r) => r.fullName },
    { header: 'Mahallalari', value: (r) => zonesText(r.mahallas) },
    { header: 'Lavozimi', value: (r) => r.position },
    { header: "Bo'lim", value: (r) => r.department ?? '—' },
    countColumn('Hisobot bergan kunlar', (r) => r.reportDays),
    countColumn('Hisobotlar soni', (r) => r.reportCount),
    { header: 'Ish vaqti (jadval)', value: (r) => `${r.workStartTime}–${r.workEndTime}`, align: 'center' },
    countColumn('Kelgan kunlar', (r) => r.daysWorked),
    durationColumn('Ishlagan vaqt (keldi–ketdi)', (r) => r.workMinutes),
    durationColumn('Ish vaqtida hududda', (r) => r.workZoneMinutes),
    durationColumn('Ish vaqtida faol', (r) => r.workActiveMinutes),
    durationColumn('Hududda (24 soat)', (r) => r.zoneMinutes),
    durationColumn('Ofisda (24 soat)', (r) => r.officeMinutes),
    durationColumn('Faol (24 soat)', (r) => r.activeMinutes),
    countColumn('Ketish belgilanmagan kunlar', (r) => r.missingCheckOutDays),
    { header: 'Holati', value: (r) => statusText(r.archived), align: 'center' },
  ];
}

type DayLine = ActivityDailyDay & { person: ActivityDailyRow };

function dailyColumns(): ExportColumn<DayLine>[] {
  return [
    { header: 'F.I.Sh.', value: (r) => r.person.fullName },
    { header: 'Lavozimi', value: (r) => r.person.position },
    { header: 'Mahallalari', value: (r) => zonesText(r.person.mahallas) },
    { header: 'Sana', value: (r) => dmy(r.date), align: 'center' },
    { header: 'Ish vaqti (jadval)', value: (r) => `${r.person.workStartTime}–${r.person.workEndTime}`, align: 'center' },
    { header: 'Keldi', value: (r) => clock(r.checkInAt), align: 'center' },
    { header: 'Ketdi', value: (r) => clock(r.checkOutAt), align: 'center' },
    durationColumn('Ishlagan vaqt', (r) => r.workMinutes),
    countColumn('Hisobotlar soni', (r) => r.reportCount),
    { header: 'Birinchi lokatsiya', value: (r) => clock(r.firstAt), align: 'center' },
    { header: 'Oxirgi lokatsiya', value: (r) => clock(r.lastAt), align: 'center' },
    durationColumn('Ish vaqtida hududda', (r) => r.workZoneMinutes),
    durationColumn('Ish vaqtida faol', (r) => r.workActiveMinutes),
    durationColumn('Hududda (24 soat)', (r) => r.zoneMinutes),
    durationColumn('Ofisda (24 soat)', (r) => r.officeMinutes),
    durationColumn('Tashqarida (24 soat)', (r) => r.outsideMinutes),
    durationColumn('Hududsiz (24 soat)', (r) => r.unassignedMinutes ?? 0),
    durationColumn('Faol (24 soat)', (r) => r.activeMinutes),
    { header: 'Holati', value: (r) => statusText(r.person.archived), align: 'center' },
  ];
}

type StretchLine = ZoneStretch & { person: ActivityDailyRow; date: string };

function stretchColumns(): ExportColumn<StretchLine>[] {
  return [
    { header: 'F.I.Sh.', value: (r) => r.person.fullName },
    { header: 'Lavozimi', value: (r) => r.person.position },
    { header: 'Sana', value: (r) => dmy(r.date), align: 'center' },
    { header: 'Dan', value: (r) => clock(r.from), align: 'center' },
    { header: 'Gacha', value: (r) => stretchEnd(r.from, r.to), align: 'center' },
    durationColumn('Davomiyligi', (r) => r.minutes),
    { header: 'Holat', value: (r) => TERRITORY_LABEL[territoryOf(r.inside, r.office, r.assigned)] },
    { header: 'Mahalla', value: (r) => r.mahallaName ?? '—' },
  ];
}

function todayColumns(): ExportColumn<OversightRow>[] {
  return [
    { header: 'F.I.Sh.', value: (r) => r.fullName },
    { header: 'Lavozim', value: (r) => r.position },
    { header: 'Yuz', value: (r) => (r.hasFace ? "Ro'yxatdan o'tgan" : "Yo'q") },
    { header: 'Holat', value: (r) => attMeta(r.attendance.status).label },
    { header: 'Keldi', value: (r) => clock(r.attendance.checkInAt), align: 'center' },
    { header: 'Ketdi', value: (r) => clock(r.attendance.checkOutAt), align: 'center' },
    durationColumn('Bugun ishlagan', (r) =>
      r.attendance.hoursWorked != null ? r.attendance.hoursWorked * 60 : null,
    ),
    {
      header: 'Hudud',
      value: (r) =>
        !r.location.hasLocation
          ? "Ma'lumot yo'q"
          : TERRITORY_LABEL[
              territoryOf(
                r.location.insideAssignedZone,
                r.location.insideOffice,
                (r.assignedMahallaCodes ?? []).length > 0,
              )
            ],
    },
    { header: 'Hozirgi mahalla', value: (r) => r.location.mahallaName ?? '—' },
    {
      header: "Oylik (sof, so'm)",
      value: (r) => r.salaryNet ?? 0,
      align: 'right',
      total: (rs) => formatSom(rs.reduce((a, r) => a + (r.salaryNet ?? 0), 0)),
    },
    {
      header: "Premya (so'm)",
      value: (r) => r.premyaThisMonth,
      align: 'right',
      total: (rs) => formatSom(rs.reduce((a, r) => a + r.premyaThisMonth, 0)),
    },
  ];
}

/* ───────────── Workbook ───────────── */

export interface ActivityReportInput {
  range: Range;
  /** Bugungi kun — bugungi hisoblagichlar faqat davr shu kunni qamrasa yoziladi. */
  today: string;
  activity: Activity;
  /** null — kunma-kun varaqlar yo'q (davr uzun yoki server qo'llamaydi). */
  daily: ActivityDaily | null;
  /** `range.to` oyining nazorat ma'lumoti (bugungi holat va oylik). */
  oversight: OversightData;
  filter?: ExportFilter;
  /** Qo'shimcha izoh (subtitle oxiriga). */
  note?: string;
}

export interface ActivityReport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: SheetSpec<any>[];
  employees: number;
  /** Kunlik / Oraliqlar nega yo'qligi (bor bo'lsa null). */
  dailyMissing: string | null;
}

export function buildActivityReport(input: ActivityReportInput): ActivityReport {
  const { range, today, activity, daily, oversight, filter, note } = input;
  const oversightRows = Array.isArray(oversight.rows) ? oversight.rows : [];
  const people = selectEmployees(activity.rows ?? [], oversightRows, filter);
  const archived = people.filter((p) => p.archived).length;
  const period = rangeText(range);
  const subtitle = [
    "Mirzo Ulug'bek tumani hokimligi",
    period,
    `${people.length} ta xodim${archived ? ` (arxivda ${archived})` : ''}`,
    ...filterText(filter, archived),
    ...(note ? [note] : []),
  ].join(' · ');

  const ids = new Set(people.map((p) => p.employeeId));
  const sheets: ActivityReport['sheets'] = [
    {
      name: 'Faollik',
      columns: activityColumns(),
      rows: people.map((r, i) => ({ ...r, n: i + 1 })),
      opts: { title: `Xodimlar faolligi — ${period}`, subtitle },
    },
  ];

  let dailyMissing: string | null = null;
  if (daily) {
    // Faollik bilan bir xil xodimlar to'plami.
    const persons = (daily.rows ?? []).filter((p) => ids.has(p.employeeId));
    const days: DayLine[] = persons.flatMap((person) => person.days.map((d) => ({ ...d, person })));
    const stretches: StretchLine[] = days.flatMap((d) =>
      (d.stretches ?? []).map((s) => ({ ...s, person: d.person, date: d.date })),
    );
    sheets.push(
      { name: 'Kunlik', columns: dailyColumns(), rows: days, opts: { title: `Kunlik faollik — ${period}`, subtitle } },
      {
        name: 'Oraliqlar',
        columns: stretchColumns(),
        rows: stretches,
        opts: { title: `Vaqt oraliqlari — ${period}`, subtitle },
      },
    );
  } else {
    dailyMissing =
      daysInclusive(range.from, range.to) > MAX_DAILY_DAYS
        ? `davr ${MAX_DAILY_DAYS} kundan uzun`
        : "server kunma-kun ma'lumot bermadi";
  }

  const includesToday = range.from <= today && today <= range.to;
  if (includesToday) {
    const todayRows = selectEmployees(oversightRows, oversightRows, filter);
    sheets.push({
      name: 'Bugungi holat',
      columns: todayColumns(),
      rows: todayRows,
      opts: {
        title: `Bugungi holat — ${dmy(today)}`,
        subtitle: ['Faol xodimlar', ...filterText(filter, 0)].join(' · '),
      },
    });
  }

  const s = oversight.summary;
  const singleMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  const [year, month] = range.to.split('-').map(Number);
  const summaryRows: { k: string; v: string | number }[] = [
    { k: 'Davr', v: period },
    { k: 'Hisobotdagi xodimlar', v: people.length },
    { k: 'Shulardan arxivda', v: archived },
    { k: 'Hisobot bergan xodimlar', v: people.filter((r) => r.reportDays > 0).length },
    { k: 'Jami hisobotlar', v: people.reduce((a, r) => a + r.reportCount, 0) },
    ...(includesToday && s
      ? [
          { k: 'Bugun: jami faol xodim', v: s.total },
          { k: "Bugun: yuz ro'yxatdan o'tgan", v: `${s.faceEnrolled}/${s.total}` },
          { k: 'Bugun: hozir ish joyida', v: s.presentNow },
          { k: 'Bugun: kechikkan', v: s.lateNow },
          { k: 'Bugun: hududdan tashqarida', v: s.outsideZone },
        ]
      : []),
    ...(singleMonth && s
      ? [{ k: `Oylik fondi — ${MONTH_NAMES[month - 1]} ${year} (sof, so'm)`, v: s.salaryTotalNet }]
      : []),
    ...(dailyMissing ? [{ k: "«Kunlik» va «Oraliqlar» varaqlari yo'q", v: dailyMissing }] : []),
    { k: 'Izoh: ish vaqtida', v: "Faqat xodimning ish jadvali oralig'idagi vaqt (ish kuni yoki kelgan kun)" },
    { k: 'Izoh: faol', v: 'Hududda + ofisda + tashqarida; 15 daqiqadan uzun uzilish hisoblanmaydi' },
    { k: 'Izoh: ofisda', v: 'Biriktirilgan hududdan tashqarida, lekin ofisda' },
  ];
  sheets.push({
    name: 'Umumiy',
    columns: [
      { header: "Ko'rsatkich", value: (r: { k: string; v: string | number }) => r.k },
      { header: 'Qiymat', value: (r: { k: string; v: string | number }) => r.v, align: 'right' },
    ],
    rows: summaryRows,
    opts: { title: `Xodimlar faolligi — ${period}`, subtitle },
  });

  return { sheets, employees: people.length, dailyMissing };
}
