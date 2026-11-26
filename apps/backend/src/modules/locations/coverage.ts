/** Shundan uzun sukunat "joylashuv kelmadi" hisoblanadi. */
export const COVERAGE_GAP_MS = 6 * 60_000;

/**
 * `[from, to]` oynasining necha millisekundi joylashuv bilan qamralgan:
 * ketma-ket ikki nuqta orasi `maxGapMs` dan oshmasa o'sha oraliq hisoblanadi.
 * `times` — o'sish tartibida.
 */
export function coveredMs(times: number[], from: number, to: number, maxGapMs = COVERAGE_GAP_MS): number {
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > maxGapMs) continue;
    total += Math.max(0, Math.min(times[i], to) - Math.max(times[i - 1], from));
  }
  return total;
}
