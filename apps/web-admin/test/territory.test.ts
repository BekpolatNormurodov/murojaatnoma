import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixInZone, isPastDayWindow, statusKey, trackHistoryDays, trackRange } from '../src/features/map/mapShared.ts';
import { sameOriginUploadUrl } from '../src/shared/lib/media.ts';
import { territoryOf } from '../src/shared/lib/territory.ts';

process.env.TZ = 'Asia/Tashkent';

test('territory wins, then office, then outside', () => {
  assert.equal(territoryOf(true, true), 'zone');
  assert.equal(territoryOf(false, true), 'office');
  assert.equal(territoryOf(false, false), 'outside');
  // Older backend: no insideOffice field.
  assert.equal(territoryOf(false, undefined), 'outside');
});

test('being at the office does not count as being in the territory', () => {
  const fix = {
    latitude: 0,
    longitude: 0,
    accuracy: 5,
    recordedAt: '2026-11-25T05:00:00Z',
    insideOffice: true,
    insideDistrict: true,
  };
  assert.equal(fixInZone({ ...fix, insideAssignedZone: false }), false);
  assert.equal(fixInZone(fix), true); // older backend: district
});

test('map status: territory first, else office, else outside', () => {
  const at = (insideAssignedZone: boolean | undefined, insideOffice: boolean, insideDistrict = true) =>
    statusKey({ hasLocation: true, isStale: false, insideAssignedZone, insideOffice, insideDistrict } as Parameters<
      typeof statusKey
    >[0]);
  assert.equal(at(true, true), 'zone');
  assert.equal(at(true, false, false), 'zone'); // within the GPS tolerance of the border
  assert.equal(at(false, true), 'office');
  assert.equal(at(false, false), 'offzone');
  assert.equal(at(false, false, false), 'outside');
  assert.equal(at(undefined, true), 'zone'); // older backend: district
});

test('route history: seven previous days, each a whole local day', () => {
  const now = new Date('2026-11-25T10:00:00+05:00');
  const days = trackHistoryDays(now);
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-11-24');
  assert.equal(days[6], '2026-11-18');
  assert.deepEqual(trackRange('2026-11-18', now), {
    from: '2026-11-17T19:00:00.000Z',
    to: '2026-11-18T18:59:59.999Z',
  });
  assert.equal(isPastDayWindow('2026-11-18'), true);
  assert.equal(isPastDayWindow('today'), false);
  assert.equal(trackRange('today', now).to, now.toISOString());
});

test('own upload URLs become same-origin, others stay', () => {
  const url = 'https://murojaatnoma.uz/uploads/a-1.mov';
  assert.equal(sameOriginUploadUrl(url, 'www.murojaatnoma.uz'), '/uploads/a-1.mov');
  assert.equal(sameOriginUploadUrl(url, 'murojaatnoma.uz'), '/uploads/a-1.mov');
  assert.equal(sameOriginUploadUrl(url, 'localhost'), url);
  assert.equal(sameOriginUploadUrl('https://evil.example/uploads/a.mov', 'murojaatnoma.uz'), 'https://evil.example/uploads/a.mov');
  assert.equal(sameOriginUploadUrl('/uploads/a.mov', 'murojaatnoma.uz'), '/uploads/a.mov');
});
