import { MAX_DRAW_ACCURACY_M, TRACK_GAP_MS } from './mapShared.ts';

/** A stretch of the day spent in one mahalla without a signal break. */
export interface RouteStop {
  mahallaName: string | null;
  from: string;
  to: string;
  /** Indexes into the day's points, both included. */
  startIdx: number;
  endIdx: number;
  /** A signal break of at least {@link TRACK_GAP_MS} came right before this stretch. */
  afterGap: boolean;
}

type StopFix = { recordedAt: string; mahallaName: string | null; accuracy: number | null };

/** Crossing a border for less than this is GPS wobble, not a visit. */
export const MIN_STOP_MS = 60_000;

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Turns a chronological track into "where, from when to when". A stretch lasts
 * until the first fix of the next one (unless the signal broke in between).
 */
export function routeStops(points: StopFix[]): RouteStop[] {
  const raw: RouteStop[] = [];
  let prevAt: number | null = null;
  points.forEach((p, i) => {
    if (p.accuracy != null && p.accuracy > MAX_DRAW_ACCURACY_M) return;
    const at = ms(p.recordedAt);
    const gap = prevAt != null && at - prevAt >= TRACK_GAP_MS;
    const last = raw[raw.length - 1];
    if (last && !gap && last.mahallaName === p.mahallaName) {
      last.to = p.recordedAt;
      last.endIdx = i;
    } else {
      if (last && !gap) last.to = p.recordedAt;
      raw.push({ mahallaName: p.mahallaName, from: p.recordedAt, to: p.recordedAt, startIdx: i, endIdx: i, afterGap: gap });
    }
    prevAt = at;
  });

  const out: RouteStop[] = [];
  raw.forEach((s, i) => {
    const prev = out[out.length - 1];
    const next = raw[i + 1];
    const brief = ms(s.to) - ms(s.from) < MIN_STOP_MS;
    // A brief stretch with movement on both sides joins the one before it; so
    // does a return to the same place afterwards.
    if (prev && !s.afterGap && ((brief && next && !next.afterGap) || prev.mahallaName === s.mahallaName)) {
      prev.to = s.to;
      prev.endIdx = s.endIdx;
    } else {
      out.push({ ...s });
    }
  });
  return out;
}
