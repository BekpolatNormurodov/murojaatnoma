import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRows, matches } from '../src/features/monitoring/monitoring.ts';

const now = new Date('2026-11-26T09:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const ok = { gpsEnabled: true, permission: 'always' as const, batteryExempt: true, tracking: true };
const person = (id: string, lastMin: number | null, extra = {}) => ({
  employeeId: id,
  fullName: id,
  position: '',
  avatarUrl: null,
  lastLocationAt: lastMin === null ? null : ago(lastMin),
  deviceStatus: ok,
  deviceStatusAt: ago(1),
  ...extra,
});

const rows = buildRows({
  now,
  people: [
    person('Ishlayapti', 1),
    person('Jim', 90),
    person('Batareya', 2, { deviceStatus: { ...ok, batteryExempt: false } }),
    person('Tatil', null),
  ],
  coverage: [
    {
      employeeId: 'Ishlayapti',
      workStartTime: '09:00',
      workEndTime: '18:00',
      gapMinutes: 6,
      onlineMinutes: 160,
      windowMinutes: 200,
      coveredMinutes: 150,
      points: 160,
      firstAt: ago(160),
      lastAt: ago(1),
      onlineSince: ago(160),
      intervals: [],
      gaps: [],
    },
  ],
  attendance: [
    { employeeId: 'Jim', status: 'absent', checkIn: null },
    { employeeId: 'Tatil', status: 'leave', checkIn: null },
  ],
  reports: [{ employeeId: 'Ishlayapti', reportDays: 1 }],
});
const names = (f: Parameters<typeof matches>[1]) => rows.filter((r) => matches(r, f)).map((r) => r.fullName);

test('silent people come first, people on leave last', () => {
  assert.deepEqual(rows.map((r) => r.fullName), ['Jim', 'Ishlayapti', 'Batareya', 'Tatil']);
  assert.equal(rows[1].coverage, 75);
});

test('each alert lists only the people it concerns', () => {
  assert.deepEqual(names('silent'), ['Jim']);
  assert.deepEqual(names('settings'), ['Batareya']);
  assert.deepEqual(names('absent'), ['Jim']);
  assert.deepEqual(names('noreport'), ['Jim', 'Batareya']);
  assert.equal(names('all').length, 4);
});

test('without report data nobody is accused of a missing report', () => {
  const r = buildRows({ now, people: [person('A', 1)] });
  assert.equal(matches(r[0], 'noreport'), false);
});
