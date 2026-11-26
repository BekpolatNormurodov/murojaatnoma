import { clientInfo } from './client-info';

describe('clientInfo', () => {
  it('reads the app headers, decoding and trimming them', () => {
    expect(
      clientInfo({
        'x-app-device': 'Xiaomi%20Redmi%20(Android%2014)',
        'x-app-platform': 'android',
        'x-app-version': ' 1.4.0+25 ',
        authorization: 'x',
      }),
    ).toEqual({ device: 'Xiaomi Redmi (Android 14)', platform: 'android', appVersion: '1.4.0+25' });
  });

  it('ignores missing, repeated and empty values and caps the length', () => {
    expect(clientInfo({ 'x-app-device': ['a', 'b'], 'x-app-version': '  ' })).toEqual({});
    expect(clientInfo({ 'x-app-device': 'a'.repeat(500) }).device).toHaveLength(120);
    expect(clientInfo({ 'x-app-device': '100%' }).device).toBe('100%');
  });
});
