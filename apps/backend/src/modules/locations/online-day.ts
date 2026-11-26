import { parseTimeOnDate } from '../attendance/utils/date.util';
import { clipSpans, COVERAGE_GAP_MS, gapsWithin, onlineSpans, Span, spanMs } from './coverage';

const minutes = (ms: number) => Math.round(ms / 60_000);

const view = (s: Span) => ({ from: new Date(s.from), to: new Date(s.to), minutes: minutes(s.to - s.from) });

/**
 * One employee's day: exactly when location was being recorded and when not.
 * `day` is any instant of that (server-local) day; `times` are that day's fixes
 * in ascending order. Offline gaps are listed inside the working hours that
 * have already passed.
 */
export function onlineDay(
  times: number[],
  work: { workStartTime: string; workEndTime: string },
  day: Date,
  now: Date,
) {
  const workFrom = parseTimeOnDate(day, work.workStartTime).getTime();
  const workTo = Math.max(
    workFrom,
    Math.min(now.getTime(), parseTimeOnDate(day, work.workEndTime).getTime()),
  );
  const spans = onlineSpans(times);
  const lasting = spans.filter((s) => s.to > s.from);
  const last = spans[spans.length - 1];
  const onlineNow = !!last && now.getTime() - last.to <= COVERAGE_GAP_MS;
  return {
    workStartTime: work.workStartTime,
    workEndTime: work.workEndTime,
    gapMinutes: COVERAGE_GAP_MS / 60_000,
    /** Whole day, working hours or not. */
    onlineMinutes: minutes(spanMs(lasting)),
    /** Working hours passed so far, and the online part of them. */
    windowMinutes: minutes(workTo - workFrom),
    coveredMinutes: minutes(spanMs(clipSpans(spans, workFrom, workTo))),
    points: times.length,
    firstAt: times.length ? new Date(times[0]) : null,
    lastAt: times.length ? new Date(times[times.length - 1]) : null,
    /** Start of the stretch that is still going on; null when offline now. */
    onlineSince: onlineNow ? new Date(last.from) : null,
    intervals: lasting.map(view),
    gaps: gapsWithin(spans, workFrom, workTo)
      .filter((g) => g.to - g.from > COVERAGE_GAP_MS)
      .map(view),
  };
}
