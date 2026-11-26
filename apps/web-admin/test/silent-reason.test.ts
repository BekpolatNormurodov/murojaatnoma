import assert from 'node:assert/strict';
import { test } from 'node:test';
import { silentReason, type DeviceStatus } from '../src/features/map/silentReason.ts';

const now = new Date('2026-11-26T09:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const ok: DeviceStatus = { gpsEnabled: true, permission: 'always', batteryExempt: true, tracking: true };
const reason = (deviceStatus: DeviceStatus | null, statusAge = 1, locationAge: number | null = 1) =>
  silentReason(
    {
      deviceStatus,
      deviceStatusAt: deviceStatus ? ago(statusAge) : null,
      lastLocationAt: locationAge === null ? null : ago(locationAge),
    },
    'uz',
    now,
  );

test('a working phone needs no explanation', () => {
  assert.equal(reason(ok), null);
  assert.equal(reason(null), null);
});

test('without a report the app is missing or outdated', () => {
  assert.match(reason(null, 0, null)!, /kirmagan/);
  assert.match(reason(null, 0, 60)!, /o‘rnatilmagan —/);
});

test('a broken setting is named, even while points still arrive', () => {
  assert.equal(reason({ ...ok, gpsEnabled: false }), 'GPS o‘chiq');
  assert.match(reason({ ...ok, permission: 'whileInUse' })!, /Doim/);
  assert.match(reason({ ...ok, batteryExempt: false })!, /Batareya/);
});

test('a phone that stopped reporting is offline, with a low battery mentioned', () => {
  assert.match(reason(ok, 40, 40)!, /^Telefon o‘chiq/);
  assert.match(reason({ ...ok, battery: 4 }, 40, 40)!, /batareya 4%/);
});

test('reporting but not tracking', () => {
  assert.equal(reason({ ...ok, tracking: false }, 1, 40), 'Kuzatuv to‘xtagan');
});
