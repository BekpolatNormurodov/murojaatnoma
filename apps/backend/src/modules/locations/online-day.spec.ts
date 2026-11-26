import { onlineDay } from './online-day';

const at = (h: number, m = 0) => new Date(2026, 10, 26, h, m);
const work = { workStartTime: '09:00', workEndTime: '18:00' };
const every = (from: Date, to: Date) => {
  const out: number[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 60_000) out.push(t);
  return out;
};

describe('onlineDay', () => {
  const times = [...every(at(8, 50), at(10)), ...every(at(11), at(12))];

  it('reports stretches, gaps and the part inside working hours', () => {
    const d = onlineDay(times, work, at(0), at(12, 30));

    expect(d.onlineMinutes).toBe(130);
    expect(d.windowMinutes).toBe(210);
    expect(d.coveredMinutes).toBe(120);
    expect(d.intervals.map((i) => [i.from, i.to])).toEqual([
      [at(8, 50), at(10)],
      [at(11), at(12)],
    ]);
    expect(d.gaps.map((g) => g.minutes)).toEqual([60, 30]);
    expect(d.onlineSince).toBeNull();
  });

  it('says since when the employee is online right now', () => {
    expect(onlineDay(times, work, at(0), at(12, 3)).onlineSince).toEqual(at(11));
  });

  it('a day without any fix is one gap over the working hours', () => {
    const d = onlineDay([], work, at(0), at(23));
    expect(d.onlineMinutes).toBe(0);
    expect(d.gaps.map((g) => g.minutes)).toEqual([540]);
  });

  it('before work starts nothing is missing', () => {
    expect(onlineDay([], work, at(0), at(7)).gaps).toEqual([]);
  });
});
