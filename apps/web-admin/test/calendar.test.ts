import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampDay, fromDay, isAllowed, monthGrid, moveDay, placePopover } from '../src/shared/ui/calendar.ts';

test('the grid is six weeks starting on Monday', () => {
  const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(grid.length, 42);
  assert.deepEqual(grid[0], { day: '2026-10-26', inMonth: false });
  assert.deepEqual(grid[6], { day: '2026-11-01', inMonth: true });
  assert.equal(grid.filter((c) => c.inMonth).length, 30);
});

test('days that do not exist are rejected', () => {
  assert.equal(fromDay('2026-02-30'), null);
  assert.equal(fromDay(''), null);
});

test('bounds include both ends', () => {
  assert.equal(isAllowed('2026-11-26', undefined, '2026-11-26'), true);
  assert.equal(isAllowed('2026-11-27', undefined, '2026-11-26'), false);
  assert.equal(clampDay('2026-12-05', undefined, '2026-11-26'), '2026-11-26');
});

test('keyboard moves by day, week and month without overflowing', () => {
  assert.equal(moveDay('2026-11-01', 'ArrowLeft'), '2026-10-31');
  assert.equal(moveDay('2026-11-26', 'ArrowDown'), '2026-12-03');
  assert.equal(moveDay('2026-11-26', 'Home'), '2026-11-23');
  assert.equal(moveDay('2027-01-31', 'PageDown'), '2027-02-28');
  assert.equal(moveDay('2026-11-26', 'Enter'), null);
});

test('the drop-down flips up and stays on screen', () => {
  const size = { width: 300, height: 360 };
  const screen = { width: 1000, height: 700 };
  assert.deepEqual(placePopover({ top: 100, bottom: 144, left: 200, right: 400 }, size, screen), { above: false, top: 152, left: 200 });
  assert.deepEqual(placePopover({ top: 600, bottom: 644, left: 850, right: 980 }, size, screen), { above: true, top: 232, left: 680 });
  assert.equal(placePopover({ top: 10, bottom: 54, left: 0, right: 100 }, size, { width: 320, height: 300 }).left, 8);
});
