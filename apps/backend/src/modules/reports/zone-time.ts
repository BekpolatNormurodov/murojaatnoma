/**
 * "Hududda necha soat yurgani" — turns one employee's GPS fixes into
 * stretches of time spent in their assigned territory, at the office, or
 * outside both.
 *
 * Each fix says where the employee was at that instant. The time until the
 * next fix is credited to the state of the EARLIER fix; a silence longer
 * than `gapMs` (app closed, GPS off, phone dead) is credited to nobody and
 * breaks the stretch — so the numbers never claim time we did not observe.
 * A fix less precise than `ZONE_MAX_ACCURACY_M` says too little and is ignored.
 *
 * The three buckets are exclusive: territory first, else office, else outside.
 * `ReportsService.zoneSecondsByDay` is the SQL twin of this file — keep the
 * two rules identical.
 */

export interface ZoneFix {
  recordedAt: Date;
  insideAssignedZone: boolean;
  insideOffice: boolean;
  mahallaName: string | null;
  /** Horizontal accuracy in metres; null = unknown (counted). */
  accuracy: number | null;
}

/** One unbroken stretch in the same state and mahalla. */
export interface ZoneStretch {
  from: Date;
  to: Date;
  minutes: number;
  inside: boolean;
  /** At the office — only ever true when `inside` is false. */
  office: boolean;
  mahallaName: string | null;
}

/** Time observed in one mahalla (and state) on one day. */
export interface MahallaTime {
  /** null = outside every mahalla of the district (or not resolved). */
  name: string | null;
  minutes: number;
  /** Whether that time counted as inside the assigned territory. */
  inside: boolean;
  office: boolean;
}

export interface ZoneDay {
  /** Local calendar day, "YYYY-MM-DD". */
  date: string;
  /** Minutes observed inside the assigned territory. */
  zoneMinutes: number;
  /** Minutes at the office (outside the territory). */
  officeMinutes: number;
  /** Minutes observed outside both. */
  outsideMinutes: number;
  /** zone + office + outside — how long location was actually coming in. */
  activeMinutes: number;
  /** The part of `zoneMinutes` inside the working hours of a working day. */
  workZoneMinutes: number;
  /** The part of `activeMinutes` inside the working hours of a working day. */
  workActiveMinutes: number;
  firstAt: Date | null;
  lastAt: Date | null;
  stretches: ZoneStretch[];
  /** Where the time went: per mahalla, longest first. */
  byMahalla: MahallaTime[];
}

/** The employee's schedule, for the "within working hours" figures. */
export interface WorkSchedule {
  /** "HH:MM". */
  startTime: string;
  endTime: string;
  /** Do working hours count on this day (a working weekday, or the employee checked in)? */
  counts: (date: string) => boolean;
}

/** A pause this long between two fixes is a break, not time spent anywhere. */
export const ZONE_GAP_MS = 15 * 60_000;
/** Fixes less precise than this (metres) are ignored. */
export const ZONE_MAX_ACCURACY_M = 150;

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfNextLocalDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(24, 0, 0, 0);
  return n;
}

/** Whole minutes in a duration — every total is summed exactly and rounded once. */
export const toMinutes = (ms: number): number => Math.round(ms / 60_000);

/** "HH:MM" → minutes after midnight; anything unreadable counts as midnight. */
function minuteOfDay(hhmm: string): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Milliseconds of [from, to] (one local day) that fall inside the working hours. */
function msWithinWork(from: Date, to: Date, schedule: WorkSchedule): number {
  let start = minuteOfDay(schedule.startTime);
  let end = minuteOfDay(schedule.endTime);
  // No usable window (e.g. a night shift written as 20:00–08:00): the whole day counts.
  if (end <= start) {
    start = 0;
    end = 24 * 60;
  }
  const windowStart = new Date(from);
  windowStart.setHours(0, start, 0, 0);
  const windowEnd = new Date(from);
  windowEnd.setHours(0, end, 0, 0);
  return Math.max(
    0,
    Math.min(to.getTime(), windowEnd.getTime()) -
      Math.max(from.getTime(), windowStart.getTime()),
  );
}

/** A day on which nothing was tracked. */
export function emptyZoneDay(date: string): ZoneDay {
  return {
    date,
    zoneMinutes: 0,
    officeMinutes: 0,
    outsideMinutes: 0,
    activeMinutes: 0,
    workZoneMinutes: 0,
    workActiveMinutes: 0,
    firstAt: null,
    lastAt: null,
    stretches: [],
    byMahalla: [],
  };
}

type Bucket = 'zone' | 'office' | 'outside';

/** Exact (unrounded) sums gathered for one day. */
interface DayTotals {
  all: Record<Bucket, number>;
  work: Record<Bucket, number>;
  mahallas: Map<string, MahallaTime & { ms: number }>;
}

const newTotals = (): DayTotals => ({
  all: { zone: 0, office: 0, outside: 0 },
  work: { zone: 0, office: 0, outside: 0 },
  mahallas: new Map(),
});

/**
 * `fixes` must be in chronological order. Returns one entry per local day
 * that has at least one usable fix, oldest first. A stretch that crosses
 * midnight is cut there, so every day's total only holds that day's minutes.
 * Without a `schedule` the working-hours figures stay 0.
 */
export function zoneDays(
  fixes: ZoneFix[],
  schedule?: WorkSchedule,
  gapMs: number = ZONE_GAP_MS,
): ZoneDay[] {
  const usable = fixes.filter(
    (f) => f.accuracy == null || f.accuracy <= ZONE_MAX_ACCURACY_M,
  );
  const days = new Map<string, { day: ZoneDay; totals: DayTotals }>();
  const entryOf = (date: string) => {
    let e = days.get(date);
    if (!e) {
      e = { day: emptyZoneDay(date), totals: newTotals() };
      days.set(date, e);
    }
    return e;
  };

  const credit = (from: Date, to: Date, fix: ZoneFix): void => {
    const ms = to.getTime() - from.getTime();
    if (ms <= 0) return;
    const { day, totals } = entryOf(localDate(from));
    const inside = fix.insideAssignedZone;
    const office = !inside && fix.insideOffice;
    const bucket: Bucket = inside ? 'zone' : office ? 'office' : 'outside';
    const name = fix.mahallaName;

    totals.all[bucket] += ms;
    if (schedule?.counts(day.date)) {
      totals.work[bucket] += msWithinWork(from, to, schedule);
    }
    const key = `${bucket}|${name ?? ''}`;
    const m = totals.mahallas.get(key) ?? { name, inside, office, minutes: 0, ms: 0 };
    m.ms += ms;
    totals.mahallas.set(key, m);

    const last = day.stretches[day.stretches.length - 1];
    if (
      last &&
      last.inside === inside &&
      last.office === office &&
      last.mahallaName === name &&
      last.to.getTime() === from.getTime()
    ) {
      last.to = to;
    } else {
      day.stretches.push({ from, to, minutes: 0, inside, office, mahallaName: name });
    }
  };

  for (let i = 0; i < usable.length; i++) {
    const a = usable[i];
    const { day } = entryOf(localDate(a.recordedAt));
    if (!day.firstAt) day.firstAt = a.recordedAt;
    day.lastAt = a.recordedAt;

    const b = usable[i + 1];
    if (!b) continue;
    const span = b.recordedAt.getTime() - a.recordedAt.getTime();
    if (span <= 0 || span > gapMs) continue;

    const midnight = startOfNextLocalDay(a.recordedAt);
    if (b.recordedAt.getTime() > midnight.getTime()) {
      credit(a.recordedAt, midnight, a);
      credit(midnight, b.recordedAt, a);
    } else {
      credit(a.recordedAt, b.recordedAt, a);
    }
  }

  return [...days.values()]
    .sort((x, y) => x.day.date.localeCompare(y.day.date))
    .map(({ day, totals }) => {
      for (const s of day.stretches) {
        s.minutes = toMinutes(s.to.getTime() - s.from.getTime());
      }
      day.zoneMinutes = toMinutes(totals.all.zone);
      day.officeMinutes = toMinutes(totals.all.office);
      day.outsideMinutes = toMinutes(totals.all.outside);
      day.activeMinutes = day.zoneMinutes + day.officeMinutes + day.outsideMinutes;
      day.workZoneMinutes = toMinutes(totals.work.zone);
      // Summed from rounded buckets, like activeMinutes, so it never exceeds it.
      day.workActiveMinutes =
        day.workZoneMinutes +
        toMinutes(totals.work.office) +
        toMinutes(totals.work.outside);
      day.byMahalla = [...totals.mahallas.values()]
        .map(({ name, inside, office, ms }) => ({
          name,
          inside,
          office,
          minutes: toMinutes(ms),
        }))
        .filter((x) => x.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
      return day;
    });
}
