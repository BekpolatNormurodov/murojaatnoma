import { zoneDays, ZoneFix } from './zone-time';

const at = (hhmm: string, day = 24): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, day, h, m, 0, 0);
};
const fix = (hhmm: string, inside: boolean, mahalla = 'Olmazor', day = 24): ZoneFix => ({
  recordedAt: at(hhmm, day),
  insideAssignedZone: inside,
  mahallaName: mahalla,
});

describe('hududda yurgan vaqt (zone time)', () => {
  it('credits the time between fixes to the earlier fix and merges equal stretches', () => {
    const [day] = zoneDays([
      fix('09:00', true),
      fix('09:05', true),
      fix('09:10', false, 'Boshqa'),
      fix('09:20', true),
      fix('09:30', true),
    ]);
    expect(day.date).toBe('2026-11-24');
    expect(day.zoneMinutes).toBe(20); // 09:00–09:10 + 09:20–09:30
    expect(day.outsideMinutes).toBe(10); // 09:10–09:20
    expect(day.activeMinutes).toBe(30);
    expect(day.stretches.map((s) => [s.inside, s.minutes])).toEqual([
      [true, 10],
      [false, 10],
      [true, 10],
    ]);
    expect(day.stretches[1].mahallaName).toBe('Boshqa');
    expect(day.byMahalla).toEqual([
      { name: 'Olmazor', inside: true, minutes: 20 },
      { name: 'Boshqa', inside: false, minutes: 10 },
    ]);
    expect(day.firstAt).toEqual(at('09:00'));
    expect(day.lastAt).toEqual(at('09:30'));
  });

  it('a long silence is nobody’s time and splits the stretch', () => {
    const [day] = zoneDays([fix('09:00', true), fix('09:10', true), fix('11:00', true), fix('11:05', true)]);
    expect(day.zoneMinutes).toBe(15);
    expect(day.stretches).toHaveLength(2);
    expect(day.stretches[0].to).toEqual(at('09:10'));
    expect(day.stretches[1].from).toEqual(at('11:00'));
  });

  it('a single fix counts as presence but no minutes; empty input gives no days', () => {
    const [day] = zoneDays([fix('14:00', true)]);
    expect(day).toMatchObject({ zoneMinutes: 0, activeMinutes: 0, stretches: [], byMahalla: [] });
    expect(day.firstAt).toEqual(at('14:00'));
    expect(zoneDays([])).toEqual([]);
  });

  it('cuts a stretch at local midnight so each day holds only its own minutes', () => {
    const days = zoneDays([fix('23:55', true, 'Olmazor', 24), fix('00:05', true, 'Olmazor', 25)]);
    expect(days.map((d) => [d.date, d.zoneMinutes])).toEqual([
      ['2026-11-24', 5],
      ['2026-11-25', 5],
    ]);
  });
});
