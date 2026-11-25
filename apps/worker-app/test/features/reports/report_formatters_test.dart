import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';

void main() {
  group('formatMinutes', () {
    test('hours and minutes', () {
      expect(formatMinutes(320), '5 soat 20 daq');
      expect(formatMinutes(61), '1 soat 1 daq');
    });
    test('whole hours / minutes only / zero', () {
      expect(formatMinutes(120), '2 soat');
      expect(formatMinutes(45), '45 daq');
      expect(formatMinutes(0), '0 daq');
      expect(formatMinutes(-5), '0 daq');
    });
  });

  test('formatDurationSec', () {
    expect(formatDurationSec(0), '0:00');
    expect(formatDurationSec(65), '1:05');
    expect(formatDurationSec(3725), '1:02:05');
    expect(formatDurationSec(-3), '0:00');
  });

  test('formatFileSize', () {
    expect(formatFileSize(512), '512 B');
    expect(formatFileSize(2048), '2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024), '5.0 MB');
  });

  test('formatClock pads hours and minutes', () {
    expect(formatClock(DateTime(2026, 1, 1, 9, 5)), '09:05');
    expect(formatClock(DateTime(2026, 1, 1, 23, 40)), '23:40');
  });

  test('ymd / parseYmd round-trip', () {
    expect(ymd(DateTime(2026, 3, 7)), '2026-03-07');
    expect(parseYmd('2026-03-07'), DateTime(2026, 3, 7));
    expect(parseYmd('garbage'), isNull);
  });

  test('formatDayTitle: Bugun / Kecha / long form', () {
    final now = DateTime(2026, 11, 25, 14);
    expect(formatDayTitle('2026-11-25', now: now), 'Bugun');
    expect(formatDayTitle('2026-11-24', now: now), 'Kecha');
    expect(formatDayTitle('2026-11-23', now: now), '23-noyabr, dushanba');
    expect(formatDayTitle('bad', now: now), 'bad');
  });

  test('formatDayShort', () {
    expect(formatDayShort(DateTime(2026, 11, 23)), '23-noy');
  });
}
