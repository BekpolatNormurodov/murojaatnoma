import { coveredMs } from './coverage';

const min = (n: number) => n * 60_000;

describe('coveredMs', () => {
  it('counts only stretches without a long silence', () => {
    const times = [0, 2, 4, 30, 33].map(min);
    expect(coveredMs(times, 0, min(60))).toBe(min(7));
  });

  it('clips to the window', () => {
    expect(coveredMs([0, 5, 10].map(min), min(3), min(8))).toBe(min(5));
  });

  it('a single point or none covers nothing', () => {
    expect(coveredMs([min(1)], 0, min(10))).toBe(0);
    expect(coveredMs([], 0, min(10))).toBe(0);
  });
});
