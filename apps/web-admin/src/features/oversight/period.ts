/* ============================================================
   Davr (sana oralig'i) yordamchilari — toza funksiyalar.
   Kunlar mahalliy "YYYY-MM-DD".
   ============================================================ */

/** Server davr yakunida qabul qiladigan eng uzun oraliq (kun, ikkala chet bilan). */
export const MAX_RANGE_DAYS = 93;
/** Kunma-kun varaqlar (Excel "Kunlik", "Oraliqlar") uchun eng uzun oraliq. */
export const MAX_DAILY_DAYS = 31;

export interface Range {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Mahalliy kun "YYYY-MM-DD" (bugundan `offset` kun). */
export function localDay(offset = 0, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parts = (day: string) => day.split('-').map(Number);

/** "2026-11-25", -7 → "2026-11-18". */
export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  return localDay(n, new Date(y, m - 1, d));
}

/** Ikkala chet bilan kunlar soni (bir kun = 1; teskari oraliq = 0). */
export function daysInclusive(from: string, to: string): number {
  const utc = (day: string) => {
    const [y, m, d] = parts(day);
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((utc(to) - utc(from)) / 86_400_000) + 1);
}

/** Tanlangan oyning davri; joriy oy bo'lsa — bugungacha, kelajak oy — bo'sh emas, 1-kun. */
export function monthRange(year: number, month: number, today = localDay()): Range {
  const from = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(last)}`;
  return { from, to: end > today ? (today < from ? from : today) : end };
}

/** "25.11.2026". */
export function dmy(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

/** "18.11.2026 – 25.11.2026"; bir kun bo'lsa bitta sana. */
export function rangeText(r: Range): string {
  return r.from === r.to ? dmy(r.from) : `${dmy(r.from)} – ${dmy(r.to)}`;
}

/** ISO → "09:12" (mahalliy). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Oraliq oxiri; yarim tunda kesilgan bo'lsa "00:00" emas, "24:00". */
export function stretchEnd(from: string, to: string): string {
  return localDay(0, new Date(to)) > localDay(0, new Date(from)) ? '24:00' : clock(to);
}

/* ───────────── Tez davrlar ───────────── */

export type PresetKey = 'today' | 'week' | 'month';

/** `back` — bugundan tashqari yana necha kun orqaga ("7 kun" = bugun + 7 kun). */
export const PERIOD_PRESETS: { key: PresetKey; label: string; back: number }[] = [
  { key: 'today', label: 'Bugun', back: 0 },
  { key: 'week', label: '7 kun', back: 7 },
  { key: 'month', label: '30 kun', back: 29 },
];

/** Tez davr (har kuni o'zi siljiydi) yoki aniq oraliq. */
export type PeriodSelection = { preset: PresetKey } | Range;

export function resolvePeriod(sel: PeriodSelection, today = localDay()): Range {
  if (!('preset' in sel)) return sel;
  const back = PERIOD_PRESETS.find((p) => p.key === sel.preset)?.back ?? 0;
  return { from: addDays(today, -back), to: today };
}

/** Oraliqni tartibga soladi: kelajak yo'q, ko'pi bilan `maxDays` kun (oxiri saqlanadi). */
export function clampRange(r: Range, today = localDay(), maxDays = MAX_RANGE_DAYS): Range {
  let [from, to] = r.from <= r.to ? [r.from, r.to] : [r.to, r.from];
  if (to > today) to = today;
  if (from > to) from = to;
  if (daysInclusive(from, to) > maxDays) from = addDays(to, 1 - maxDays);
  return { from, to };
}

/** Oraliq tez davrlardan biriga teng bo'lsa — o'sha davr, aks holda oraliqning o'zi. */
export function toSelection(r: Range, today = localDay()): PeriodSelection {
  const hit = PERIOD_PRESETS.find((p) => r.to === today && r.from === addDays(today, -p.back));
  return hit ? { preset: hit.key } : r;
}

/** ‹ › tugmalari: oraliqni o'z uzunligicha suradi, bugundan nariga o'tmaydi. */
export function shiftRange(r: Range, dir: -1 | 1, today = localDay()): Range {
  const len = daysInclusive(r.from, r.to);
  const to = addDays(r.to, dir * len);
  if (to > today) return { from: addDays(today, 1 - len), to: today };
  return { from: addDays(r.from, dir * len), to };
}
