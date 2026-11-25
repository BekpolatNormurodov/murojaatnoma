import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampRange,
  daysInclusive,
  monthRange,
  resolvePeriod,
  shiftRange,
  toSelection,
} from '../src/features/oversight/period.ts';
import { mergeReportPages, nextReportOffset } from '../src/features/oversight/reportPages.ts';

process.env.TZ = 'Asia/Tashkent';
const TODAY = '2026-11-25';

test('"7 kun" is today plus the seven previous days', () => {
  const r = resolvePeriod({ preset: 'week' }, TODAY);
  assert.deepEqual(r, { from: '2026-11-18', to: TODAY });
  assert.equal(daysInclusive(r.from, r.to), 8);
});

test('arrows move a range by its own length and never into the future', () => {
  assert.deepEqual(shiftRange({ from: TODAY, to: TODAY }, -1, TODAY), { from: '2026-11-24', to: '2026-11-24' });
  assert.deepEqual(shiftRange({ from: '2026-11-18', to: TODAY }, -1, TODAY), { from: '2026-11-10', to: '2026-11-17' });
  assert.deepEqual(shiftRange({ from: '2026-11-20', to: '2026-11-22' }, 1, TODAY), { from: '2026-11-23', to: TODAY });
  assert.deepEqual(toSelection({ from: '2026-11-18', to: TODAY }, TODAY), { preset: 'week' });
});

test('custom ranges are ordered, capped at today and at the server span', () => {
  assert.deepEqual(clampRange({ from: '2026-12-31', to: '2026-11-01' }, TODAY), { from: '2026-11-01', to: TODAY });
  const year = clampRange({ from: '2026-01-01', to: '2026-12-31' }, TODAY);
  assert.equal(year.to, TODAY);
  assert.equal(daysInclusive(year.from, year.to), 93);
});

test('a month ends today when it is the current one', () => {
  assert.deepEqual(monthRange(2026, 11, TODAY), { from: '2026-11-01', to: TODAY });
  assert.deepEqual(monthRange(2026, 10, TODAY), { from: '2026-10-01', to: '2026-10-31' });
});

test('report pages: a full page means more, duplicates are dropped', () => {
  const page = (...ids: string[]) => ids.map((id) => ({ id }));
  assert.equal(nextReportOffset([page('a', 'b')], 2), 2);
  assert.equal(nextReportOffset([page('a')], 2), undefined);
  assert.equal(nextReportOffset([page('a', 'b'), page('b', 'c')], 2), 4);
  // A server that ignores `offset` repeats page one: stop there.
  assert.equal(nextReportOffset([page('a', 'b'), page('a', 'b')], 2), undefined);
  assert.deepEqual(mergeReportPages([page('a', 'b'), page('b', 'c')]), page('a', 'b', 'c'));
});
