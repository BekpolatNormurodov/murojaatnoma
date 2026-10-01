import { downsampleTrack, TRACK_GAP_MS } from './locations.service';

const MIN = 60_000;

function fixes(startMs: number, count: number, everyMs: number) {
  return Array.from({ length: count }, (_, i) => ({ i, recordedAt: new Date(startMs + i * everyMs) }));
}

describe('downsampleTrack', () => {
  it('returns the track untouched when it fits', () => {
    const pts = fixes(0, 10, MIN);
    expect(downsampleTrack(pts, 10)).toBe(pts);
  });

  it('thins a long day but keeps the first fix, the live end and both sides of a gap', () => {
    const morning = fixes(0, 1500, 30_000); // 12.5 h at one fix / 30 s
    const afterGap = fixes(morning[morning.length - 1].recordedAt.getTime() + TRACK_GAP_MS + MIN, 1500, 30_000);
    const pts = [...morning, ...afterGap];

    const out = downsampleTrack(pts, 500);

    expect(out.length).toBeLessThanOrEqual(510);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]); // the live end is never dropped
    expect(out).toContain(morning[morning.length - 1]);
    expect(out).toContain(afterGap[0]);
    // still chronological
    for (let k = 1; k < out.length; k++) {
      expect(out[k].recordedAt.getTime()).toBeGreaterThan(out[k - 1].recordedAt.getTime());
    }
  });
});
