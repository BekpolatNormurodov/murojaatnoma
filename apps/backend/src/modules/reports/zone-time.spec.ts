import { WorkSchedule, zoneDays, ZoneFix } from './zone-time';

const at = (hhmm: string, day = 24): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, day, h, m, 0, 0);
};
const fix = (
  hhmm: string,
  inside: boolean,
  mahalla = 'Olmazor',
  day = 24,
  over: Partial<ZoneFix> = {},
): ZoneFix => ({
  recordedAt: at(hhmm, day),
  insideAssignedZone: inside,
  insideOffice: false,
  mahallaName: mahalla,
  accuracy: 10,
  ...over,
});
const office = (hhmm: string, inside = false): ZoneFix =>
  fix(hhmm, inside, 'Markaz', 24, { insideOffice: true });
const schedule = (
  startTime = '09:00',
  endTime = '18:00',
  counts = true,
): WorkSchedule => ({
  startTime,
  endTime,
  counts: () => counts,
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
      { name: 'Olmazor', inside: true, office: false, minutes: 20 },
      { name: 'Boshqa', inside: false, office: false, minutes: 10 },
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

  it('hudud, ofis, tashqari — alohida; hudud ofisdan ustun', () => {
    const [day] = zoneDays([
      office('09:00'),
      office('09:10'),
      office('09:15', true), // territory wins over the office
      fix('09:25', false, 'Boshqa'),
      fix('09:30', false, 'Boshqa'),
    ]);
    expect(day).toMatchObject({
      zoneMinutes: 10,
      officeMinutes: 15,
      outsideMinutes: 5,
      activeMinutes: 30,
    });
    expect(day.stretches.map((s) => [s.inside, s.office, s.minutes])).toEqual([
      [false, true, 15],
      [true, false, 10],
      [false, false, 5],
    ]);
    expect(day.byMahalla).toEqual([
      { name: 'Markaz', inside: false, office: true, minutes: 15 },
      { name: 'Markaz', inside: true, office: false, minutes: 10 },
      { name: 'Boshqa', inside: false, office: false, minutes: 5 },
    ]);
  });

  it('mahalla almashsa, hudud ichida ham yangi oraliq boshlanadi', () => {
    const [day] = zoneDays([
      fix('09:00', true, 'Olmazor'),
      fix('09:10', true, 'Buyuk ipak'),
      fix('09:20', true, 'Buyuk ipak'),
      fix('09:30', true, 'Buyuk ipak'),
    ]);
    expect(day.stretches.map((s) => [s.mahallaName, s.minutes])).toEqual([
      ['Olmazor', 10],
      ['Buyuk ipak', 20],
    ]);
  });

  it('aniqligi 150 m dan yomon nuqta hisobga olinmaydi; noma’lum aniqlik — olinadi', () => {
    const [day] = zoneDays([
      fix('09:00', true, 'Olmazor', 24, { accuracy: null }),
      fix('09:05', false, 'Boshqa', 24, { accuracy: 151 }),
      fix('09:10', true, 'Olmazor', 24, { accuracy: 150 }),
      fix('09:40', false, 'Boshqa', 24, { accuracy: 900 }),
    ]);
    expect(day).toMatchObject({ zoneMinutes: 10, outsideMinutes: 0 });
    expect(day.lastAt).toEqual(at('09:10'));
    expect(zoneDays([fix('09:00', true, 'Olmazor', 24, { accuracy: 500 })])).toEqual([]);
  });

  it('ish soatlari: har bir bo‘lakning faqat jadval ichidagi qismi', () => {
    const fixes = [
      fix('08:50', true),
      fix('09:00', true),
      office('09:05'),
      fix('09:15', true),
      fix('17:55', true),
      fix('18:05', true),
      fix('18:15', true),
    ];
    const [day] = zoneDays(fixes, schedule());
    // zone: 08:50–09:05, 17:55–18:15; office: 09:05–09:15; the long gap is nobody's.
    expect(day).toMatchObject({ zoneMinutes: 35, officeMinutes: 10, activeMinutes: 45 });
    expect(day.workZoneMinutes).toBe(10); // 09:00–09:05 + 17:55–18:00
    expect(day.workActiveMinutes).toBe(20); // + 10 at the office

    // Not a working day and no check-in: nothing counts as working time.
    expect(zoneDays(fixes, schedule('09:00', '18:00', false))[0]).toMatchObject({
      zoneMinutes: 35,
      workZoneMinutes: 0,
      workActiveMinutes: 0,
    });
    // Without a schedule there are no working-hours figures.
    expect(zoneDays(fixes)[0].workActiveMinutes).toBe(0);
    // end <= start: the whole day counts.
    expect(zoneDays(fixes, schedule('20:00', '08:00'))[0]).toMatchObject({
      workZoneMinutes: 35,
      workActiveMinutes: 45,
    });
  });
});

describe('mahalla biriktirilmagan vaqt', () => {
  it('hududda ham, tashqarida ham emas — alohida va faol vaqtga kiradi', () => {
    const none = { hadTerritory: false };
    const [day] = zoneDays([
      fix('09:00', false, 'Olmazor', 24, none),
      fix('09:10', false, 'Olmazor', 24, { ...none, insideOffice: true }),
      fix('09:15', false, 'Olmazor', 24, none),
      fix('09:25', false, 'Olmazor', 24, none),
    ]);
    expect(day).toMatchObject({
      zoneMinutes: 0,
      outsideMinutes: 0,
      officeMinutes: 5,
      unassignedMinutes: 20,
      activeMinutes: 25,
    });
    expect(day.stretches.map((x) => x.assigned)).toEqual([false, false, false]);
  });
});
