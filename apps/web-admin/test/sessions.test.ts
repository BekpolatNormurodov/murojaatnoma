import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOnline, matches, sortPeople, type Session } from '../src/features/app-users/sessions.ts';

const now = new Date('2026-11-26T12:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const session = { id: 's' } as Session;
const person = (id: string, seen: number | null, sessions = 1) => ({
  id,
  name: id,
  phone: '+998 90 123 45 67',
  device: 'Xiaomi Redmi',
  appVersion: null,
  lastSeenAt: seen === null ? null : ago(seen),
  sessions: Array.from({ length: sessions }, () => session),
});

test('online needs a live session seen recently', () => {
  assert.equal(isOnline(person('a', 5), now), true);
  assert.equal(isOnline(person('a', 60), now), false);
  assert.equal(isOnline(person('a', 1, 0), now), false);
});

test('search by name, phone digits or phone model, combined with the filter', () => {
  const p = person('Anvar', 60);
  assert.ok(matches(p, 'all', 'anv', now));
  assert.ok(matches(p, 'signedIn', '12345', now));
  assert.ok(matches(p, 'all', 'redmi', now));
  assert.equal(matches(p, 'online', 'anv', now), false);
  assert.equal(matches(p, 'signedOut', '', now), false);
});

test('active people first, never signed in last', () => {
  const list = sortPeople([person('out', 1, 0), person('old', 90), person('now', 2)], now);
  assert.deepEqual(list.map((p) => p.id), ['now', 'old', 'out']);
});
