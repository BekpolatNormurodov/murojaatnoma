/* Onlayn vaqt: server javobi va vaqt chizig'i hisoblari (toza funksiyalar). */

export interface Span {
  from: string;
  to: string;
  minutes: number;
}

/** GET /locations/:id/online (va /locations/coverage qatorlari). */
export interface OnlineDay {
  workStartTime: string;
  workEndTime: string;
  gapMinutes: number;
  onlineMinutes: number;
  windowMinutes: number;
  coveredMinutes: number;
  points: number;
  firstAt: string | null;
  lastAt: string | null;
  onlineSince: string | null;
  intervals: Span[];
  gaps: Span[];
}

export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} daqiqa`;
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
};

const TASHKENT_OFFSET_MIN = 5 * 60;

/** Toshkent vaqti bo'yicha yarim tundan o'tgan daqiqa. */
export function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + TASHKENT_OFFSET_MIN) % 1440;
}

export function clock(iso: string): string {
  const m = minuteOfDay(iso);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const parseClock = (hhmm: string, fallback: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : fallback;
};

export interface Timeline {
  /** Chiziq boshi va oxiri (daqiqa), butun soatga yaxlitlangan. */
  start: number;
  end: number;
  /** Foizlarda: ish vaqti foni va onlayn bo'laklar. */
  work: { left: number; width: number };
  online: { left: number; width: number; span: Span }[];
  hours: number[];
}

/** Ish vaqti va undan tashqaridagi onlayn vaqt bitta chiziqqa sig'adi. */
export function timeline(day: Pick<OnlineDay, 'workStartTime' | 'workEndTime' | 'intervals'>): Timeline {
  const workFrom = parseClock(day.workStartTime, 9 * 60);
  const workTo = Math.max(workFrom, parseClock(day.workEndTime, 18 * 60));
  const spans = day.intervals.map((span) => {
    const from = minuteOfDay(span.from);
    const to = minuteOfDay(span.to);
    // 00:00 da tugagan bo'lak kun oxirida.
    return { span, from, to: to < from ? 1440 : to };
  });
  const start = Math.floor(Math.min(workFrom, ...spans.map((s) => s.from)) / 60) * 60;
  const end = Math.min(1440, Math.ceil(Math.max(workTo, ...spans.map((s) => s.to)) / 60) * 60);
  const size = Math.max(60, end - start);
  const at = (from: number, to: number) => ({ left: ((from - start) / size) * 100, width: ((to - from) / size) * 100 });
  const step = size > 12 * 60 ? 4 * 60 : size > 6 * 60 ? 2 * 60 : 60;
  const hours: number[] = [];
  for (let m = start; m <= end; m += step) hours.push(m);
  return {
    start,
    end: start + size,
    work: at(workFrom, workTo),
    online: spans.map((s) => ({ ...at(s.from, s.to), span: s.span })),
    hours,
  };
}

/** Onlayn va uzilishlar bitta ro'yxatda, eng yangisi birinchi. */
export const history = (day: Pick<OnlineDay, 'intervals' | 'gaps'>) =>
  [
    ...day.intervals.map((s) => ({ ...s, online: true })),
    ...day.gaps.map((s) => ({ ...s, online: false })),
  ].sort((a, b) => b.from.localeCompare(a.from) || Number(b.online) - Number(a.online));
