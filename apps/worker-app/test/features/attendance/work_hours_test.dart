import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/entities/work_hours.dart';

void main() {
  final wednesday = DateTime(2026, 11, 25);
  DateTime at(int h, [int m = 0]) => DateTime(2026, 11, 25, h, m);

  MyAttendance me(Map<String, dynamic> json) => MyAttendance.fromJson(json);

  test("the employee's own schedule is used, not 09:00-18:00", () {
    final hours = WorkHours.of(
      me({'workStartTime': '07:30', 'workEndTime': '16:00'}),
      now: wednesday,
    );
    expect(hours.label, '07:30–16:00');
    expect(hours.contains(at(7, 45)), isTrue);
    expect(hours.contains(at(17)), isFalse);
  });

  test('a day off reported by the server is outside working hours', () {
    final hours = WorkHours.of(me({'isWorkday': false}), now: wednesday);
    expect(hours.contains(at(11)), isFalse);
    // The server only spoke about that day.
    expect(hours.contains(DateTime(2026, 11, 26, 11)), isTrue);
  });

  test('night shift crosses midnight; missing values fall back', () {
    const night = WorkHours(start: '22:00', end: '06:00');
    expect(night.contains(at(23)), isTrue);
    expect(night.contains(at(5)), isTrue);
    expect(night.contains(at(12)), isFalse);
    expect(WorkHours.of(me({}), now: wednesday).label, '09:00–18:00');
  });

  test('office point and faceChecked are parsed from /attendance/me', () {
    final parsed = me({
      'isWorkday': true,
      'workplace': {'officeLat': 41.31, 'officeLng': 69.34, 'radiusM': 150},
      'today': {
        'date': '2026-11-25',
        'status': 'present',
        'checkIn': {'time': '2026-11-25T04:00:00Z', 'faceChecked': false},
      },
    });
    expect((parsed.officeLat, parsed.officeLng), (41.31, 69.34));
    expect(parsed.isWorkday, isTrue);
    expect(parsed.today.checkInFaceChecked, isFalse);
    expect(parsed.today.checkOutFaceChecked, isTrue);
  });
}
