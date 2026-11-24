/**
 * "Hududda necha soat yurgani" — turns one employee's GPS fixes into
 * stretches of time spent inside / outside their assigned territory.
 *
 * Each fix says where the employee was at that instant. The time until the
 * next fix is credited to the state of the EARLIER fix; a silence longer
 * than `gapMs` (app closed, GPS off, phone dead) is credited to nobody and
 * breaks the stretch — so the numbers never claim time we did not observe.
 */

export interface ZoneFix {
  recordedAt: Date;
  insideAssignedZone: boolean;
  mahallaName: string | null;
}

/** One unbroken stretch in the same state. */
export interface ZoneStretch {
  from: Date;
  to: Date;
  minutes: number;
  inside: boolean;
  /** Mahalla where the stretch started (may change inside the territory). */
  mahallaName: string | null;
}

/** Time observed in one mahalla on one day. */
export interface MahallaTime {
  /** null = outside every mahalla of the district (or not resolved). */
  name: string | null;
  minutes: number;
  /** Whether that time counted as inside the assigned territory. */
  inside: boolean;
}

export interface ZoneDay {
  /** Local calendar day, "YYYY-MM-DD". */
  date: string;
  /** Minutes observed inside the assigned territory. */
  zoneMinutes: number;
  /** Minutes observed outside it. */
  outsideMinutes: number;
  /** zoneMinutes + outsideMinutes — how long location was actually coming in. */
  activeMinutes: number;
  firstAt: Date | null;
  lastAt: Date | null;
  stretches: ZoneStretch[];
  /** Where the time went: per mahalla, longest first. */
  byMahalla: MahallaTime[];
}

/** A pause this long between two fixes is a break, not time spent anywhere. */
export const ZONE_GAP_MS = 15 * 60_000;

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfNextLocalDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(24, 0, 0, 0);
  return n;
}

const minutesBetween = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / 60_000;

/**
 * `fixes` must be in chronological order. Returns one entry per local day
 * that has at least one fix, oldest first. A stretch that crosses midnight is
 * cut there, so every day's total only holds that day's minutes.
 */
export function zoneDays(fixes: ZoneFix[], gapMs: number = ZONE_GAP_MS): ZoneDay[] {
  const days = new Map<string, ZoneDay>();
  const dayOf = (date: string): ZoneDay => {
    let d = days.get(date);
    if (!d) {
      d = { date, zoneMinutes: 0, outsideMinutes: 0, activeMinutes: 0, firstAt: null, lastAt: null, stretches: [], byMahalla: [] };
      days.set(date, d);
    }
    return d;
  };

  // date -> "inside|name" -> exact minutes (rounded once at the end)
  const perMahalla = new Map<string, Map<string, { name: string | null; inside: boolean; m: number }>>();

  const credit = (from: Date, to: Date, inside: boolean, mahallaName: string | null): void => {
    if (to.getTime() <= from.getTime()) return;
    const day = dayOf(localDate(from));
    const bucket = perMahalla.get(day.date) ?? new Map();
    const key = `${inside ? 1 : 0}|${mahallaName ?? ''}`;
    const cur = bucket.get(key) ?? { name: mahallaName, inside, m: 0 };
    cur.m += minutesBetween(from, to);
    bucket.set(key, cur);
    perMahalla.set(day.date, bucket);
    const last = day.stretches[day.stretches.length - 1];
    if (last && last.inside === inside && last.to.getTime() === from.getTime()) {
      last.to = to;
    } else {
      day.stretches.push({ from, to, minutes: 0, inside, mahallaName });
    }
  };

  for (let i = 0; i < fixes.length; i++) {
    const a = fixes[i];
    const day = dayOf(localDate(a.recordedAt));
    if (!day.firstAt) day.firstAt = a.recordedAt;
    day.lastAt = a.recordedAt;

    const b = fixes[i + 1];
    if (!b) continue;
    const span = b.recordedAt.getTime() - a.recordedAt.getTime();
    if (span <= 0 || span > gapMs) continue;

    const midnight = startOfNextLocalDay(a.recordedAt);
    if (b.recordedAt.getTime() > midnight.getTime()) {
      credit(a.recordedAt, midnight, a.insideAssignedZone, a.mahallaName);
      credit(midnight, b.recordedAt, a.insideAssignedZone, a.mahallaName);
    } else {
      credit(a.recordedAt, b.recordedAt, a.insideAssignedZone, a.mahallaName);
    }
  }

  const out = [...days.values()].sort((x, y) => x.date.localeCompare(y.date));
  for (const day of out) {
    let zone = 0;
    let outside = 0;
    for (const s of day.stretches) {
      const m = minutesBetween(s.from, s.to);
      s.minutes = Math.round(m);
      if (s.inside) zone += m;
      else outside += m;
    }
    day.zoneMinutes = Math.round(zone);
    day.outsideMinutes = Math.round(outside);
    day.activeMinutes = day.zoneMinutes + day.outsideMinutes;
    day.byMahalla = [...(perMahalla.get(day.date)?.values() ?? [])]
      .map((x) => ({ name: x.name, inside: x.inside, minutes: Math.round(x.m) }))
      .filter((x) => x.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }
  return out;
}
