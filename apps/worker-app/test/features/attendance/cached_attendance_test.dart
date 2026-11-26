import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';

Map<String, dynamic> _cached(String date) => {
  'today': {
    'date': date,
    'checkIn': '09:00',
    'checkOut': '18:00',
    'status': 'present',
    'hours': 9,
  },
  'week': <Object>[],
};

void main() {
  final now = DateTime(2026, 11, 27, 8);
  Map<String, dynamic> today(Map<String, dynamic> d) =>
      AttendanceRemoteDataSourceApiImpl.withoutOldToday(d, now: now)['today']
          as Map<String, dynamic>;

  test('a cached earlier day does not count as today', () {
    final t = today(_cached('2026-11-26'));
    expect(t['checkIn'], isNull);
    expect(t['checkOut'], isNull);
    expect(t['date'], '2026-11-27');
  });

  test('a cached answer for today is kept', () {
    expect(today(_cached('2026-11-27'))['checkIn'], '09:00');
  });
}
