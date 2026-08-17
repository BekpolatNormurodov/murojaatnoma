/**
 * Small local-day helpers shared by the attendance service. "Local day"
 * means the Node process's own timezone, matching the rest of the module
 * (reports already bucketed by `setHours(0, 0, 0, 0)` in server-local time).
 */

/** Inclusive [00:00:00.000, 23:59:59.999] window for the day containing `date`. */
export function dayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/**
 * Builds a Date on the same local day as `date` at the wall-clock time
 * encoded by `hhmm` (e.g. "09:00"). Falls back to midnight for a
 * malformed/missing value rather than throwing, since work-time strings are
 * free-form on the Employee record.
 */
export function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [hoursStr, minutesStr] = (hhmm ?? '').split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  const result = new Date(date);
  result.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return result;
}

/** Whole minutes `date` falls after `reference` (0 when `date` is at or before it). */
export function minutesAfter(reference: Date, date: Date): number {
  return Math.floor((date.getTime() - reference.getTime()) / 60_000);
}

/**
 * Local calendar day as `YYYY-MM-DD` (server-local time, matching the day
 * bucket produced by `dayRange`). Used to group attendance records by day
 * for multi-day views.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
