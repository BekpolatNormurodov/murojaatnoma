/** Shundan uzun sukunat "joylashuv kelmadi" (oflayn) hisoblanadi. */
export const COVERAGE_GAP_MS = 6 * 60_000;

export interface Span {
  from: number;
  to: number;
}

/**
 * Uzluksiz "onlayn" oraliqlar: ketma-ket nuqtalar orasi `maxGapMs` dan
 * oshmaguncha bitta oraliq. Yakka nuqta — davomiyligi nol oraliq.
 * `times` — o'sish tartibida.
 */
export function onlineSpans(times: number[], maxGapMs = COVERAGE_GAP_MS): Span[] {
  const spans: Span[] = [];
  for (const t of times) {
    const last = spans[spans.length - 1];
    if (last && t - last.to <= maxGapMs) last.to = t;
    else spans.push({ from: t, to: t });
  }
  return spans;
}

/** `[from, to]` oynasi ichidagi qismlar. */
export function clipSpans(spans: Span[], from: number, to: number): Span[] {
  return spans
    .map((s) => ({ from: Math.max(s.from, from), to: Math.min(s.to, to) }))
    .filter((s) => s.to > s.from);
}

/** `[from, to]` oynasida `spans` qamramagan bo'shliqlar. */
export function gapsWithin(spans: Span[], from: number, to: number): Span[] {
  const gaps: Span[] = [];
  let cursor = from;
  for (const s of clipSpans(spans, from, to)) {
    if (s.from > cursor) gaps.push({ from: cursor, to: s.from });
    cursor = s.to;
  }
  if (to > cursor) gaps.push({ from: cursor, to });
  return gaps;
}

export const spanMs = (spans: Span[]) => spans.reduce((sum, s) => sum + (s.to - s.from), 0);

/** `[from, to]` oynasining necha millisekundi joylashuv bilan qamralgan. */
export const coveredMs = (times: number[], from: number, to: number, maxGapMs = COVERAGE_GAP_MS) =>
  spanMs(clipSpans(onlineSpans(times, maxGapMs), from, to));
