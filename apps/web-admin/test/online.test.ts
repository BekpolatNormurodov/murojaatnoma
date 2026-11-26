import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock, duration, history, timeline } from '../src/features/oversight/online.ts';

// Toshkent = UTC+5.
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 26, h - 5, m)).toISOString();
const span = (from: string, to: string, minutes: number) => ({ from, to, minutes });

test('times are shown in Tashkent time whatever the browser zone', () => {
  assert.equal(clock('2026-11-26T04:05:00.000Z'), '09:05');
  assert.equal(clock('2026-11-25T19:30:00.000Z'), '00:30');
});

test('durations read naturally', () => {
  assert.equal(duration(0), '0 daqiqa');
  assert.equal(duration(60), '1 soat');
  assert.equal(duration(312), '5 soat 12 daqiqa');
});

test('the line covers working hours and stretches to online time outside them', () => {
  const line = timeline({
    workStartTime: '09:00',
    workEndTime: '18:00',
    intervals: [span(at(7, 30), at(9), 90), span(at(12), at(13), 60)],
  });
  assert.equal(line.start, 7 * 60);
  assert.equal(line.end, 18 * 60);
  assert.ok(Math.abs(line.online[0].left - (30 / 660) * 100) < 0.001);
  assert.ok(Math.abs(line.work.left - (120 / 660) * 100) < 0.001);
  assert.equal(line.hours[0], 420);
});

test('online and offline stretches are listed together, newest first', () => {
  const rows = history({ intervals: [span(at(9), at(10), 60)], gaps: [span(at(10), at(11), 60)] });
  assert.deepEqual(rows.map((r) => r.online), [false, true]);
});
