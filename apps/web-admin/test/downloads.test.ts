import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadUrl, parseManifest } from '../src/features/download/downloads.ts';

test('known apps are listed, worker first', () => {
  const list = parseManifest({
    apps: {
      user: { version: '1.2.0', build: 13, file: 'fuqaro-1.2.0+13.apk' },
      worker: { version: '1.3.0', build: 21, file: 'xodim-1.3.0+21.apk' },
      other: { version: '1', build: 1, file: 'x.apk' },
    },
  });
  assert.deepEqual(list.map((r) => r.key), ['worker', 'user']);
});

test('bad data and paths outside the folder are ignored', () => {
  assert.deepEqual(parseManifest(null), []);
  assert.deepEqual(parseManifest('<html>'), []);
  assert.deepEqual(parseManifest({ apps: { worker: { version: '1', file: '../x.apk' } } }), []);
  assert.deepEqual(parseManifest({ apps: { worker: { version: '1', file: 'https://evil/x.apk' } } }), []);
});

test('plus in a file name survives the address', () => {
  assert.equal(downloadUrl('a-1.0+2.apk'), '/downloads/a-1.0%2B2.apk');
});
