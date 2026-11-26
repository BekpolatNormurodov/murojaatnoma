import { coveredMs, gapsWithin, onlineSpans } from './coverage';

const min = (n: number) => n * 60_000;

describe('online time', () => {
  const times = [0, 2, 4, 30, 33, 50].map(min);

  it('splits into stretches at a long silence', () => {
    expect(onlineSpans(times)).toEqual([
      { from: 0, to: min(4) },
      { from: min(30), to: min(33) },
      { from: min(50), to: min(50) },
    ]);
  });

  it('exactly the limit still counts as one stretch', () => {
    expect(onlineSpans([0, min(6)])).toHaveLength(1);
    expect(onlineSpans([0, min(6) + 1])).toHaveLength(2);
  });

  it('counts only the stretches, clipped to the window', () => {
    expect(coveredMs(times, 0, min(60))).toBe(min(7));
    expect(coveredMs([0, 5, 10].map(min), min(3), min(8))).toBe(min(5));
    expect(coveredMs([min(1)], 0, min(10))).toBe(0);
    expect(coveredMs([], 0, min(10))).toBe(0);
  });

  it('offline time is everything else in the window', () => {
    expect(gapsWithin(onlineSpans(times), min(-10), min(40))).toEqual([
      { from: min(-10), to: 0 },
      { from: min(4), to: min(30) },
      { from: min(33), to: min(40) },
    ]);
    expect(gapsWithin([], 0, min(5))).toEqual([{ from: 0, to: min(5) }]);
    expect(gapsWithin([], min(5), min(5))).toEqual([]);
  });
});
