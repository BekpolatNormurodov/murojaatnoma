import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lastTrackDay } from '../src/features/map/mapShared.ts';
import { routeStops } from '../src/features/map/routeStops.ts';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 25, 9, 0, 0) + minute * 60_000).toISOString();
const fix = (minute: number, mahallaName: string | null, accuracy = 5) => ({ recordedAt: at(minute), mahallaName, accuracy });

test('a stretch lasts until the next mahalla begins', () => {
  const stops = routeStops([fix(0, 'A'), fix(5, 'A'), fix(10, 'B'), fix(20, 'B')]);
  assert.deepEqual(
    stops.map((s) => [s.mahallaName, s.from, s.to]),
    [['A', at(0), at(10)], ['B', at(10), at(20)]],
  );
});

test('border wobble shorter than a minute does not split a stretch', () => {
  const stops = routeStops([fix(0, 'A'), fix(5, 'A'), fix(5.2, 'B'), fix(5.4, 'A'), fix(10, 'A')]);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].to, at(10));
  assert.equal(stops[0].endIdx, 4);
});

test('a long signal break starts a new stretch and is not counted as time', () => {
  const stops = routeStops([fix(0, 'A'), fix(5, 'A'), fix(60, 'A'), fix(65, 'A')]);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].to, at(5));
  assert.equal(stops[1].afterGap, true);
});

test('coarse fixes are ignored', () => {
  const stops = routeStops([fix(0, 'A'), fix(3, 'B', 900), fix(6, 'A')]);
  assert.equal(stops.length, 1);
});

test('no points, no stops', () => {
  assert.deepEqual(routeStops([]), []);
});

test('with nothing today the last walked day is offered, otherwise today stays', () => {
  const now = new Date(2026, 10, 25, 14, 0);
  assert.equal(lastTrackDay(new Date(2026, 10, 23, 23, 50).toISOString(), now), '2026-11-23');
  assert.equal(lastTrackDay(new Date(2026, 10, 25, 0, 5).toISOString(), now), null);
  assert.equal(lastTrackDay(null, now), null);
});
