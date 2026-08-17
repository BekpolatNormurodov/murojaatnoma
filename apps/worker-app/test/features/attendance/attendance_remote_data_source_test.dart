import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';

void main() {
  // Faqat Mock impl sinaladi — Api impl jonli backend talab qiladi
  // (mock-first; qarang: `AttendanceRemoteDataSourceApiImpl`).
  group(AttendanceRemoteDataSourceMockImpl, () {
    late AttendanceRemoteDataSourceMockImpl subject;

    const embedding = [0.1, 0.2, 0.3];
    const latitude = 41.3111;
    const longitude = 69.3402;

    setUp(() {
      subject = AttendanceRemoteDataSourceMockImpl();
    });

    test(
      'checkIn returns a valid CheckScanResult for CHECK_IN',
      () async {
        final result = await subject.checkIn(
          embedding: embedding,
          latitude: latitude,
          longitude: longitude,
        );

        expect(result.isValid, isTrue);
        expect(result.type, 'CHECK_IN');
        expect(result.faceScore, greaterThan(0));
      },
    );

    test(
      'checkOut returns a valid CheckScanResult for CHECK_OUT',
      () async {
        final result = await subject.checkOut(
          embedding: embedding,
          latitude: latitude,
          longitude: longitude,
        );

        expect(result.isValid, isTrue);
        expect(result.type, 'CHECK_OUT');
      },
    );

    test(
      'myAttendance reflects checkIn/checkOut performed earlier in the '
      'same instance (in-memory mock state)',
      () async {
        final before = await subject.myAttendance();
        expect(before.today.checkIn, isNull);
        expect(before.week, isNotEmpty);

        await subject.checkIn(
          embedding: embedding,
          latitude: latitude,
          longitude: longitude,
        );
        final afterCheckIn = await subject.myAttendance();
        expect(afterCheckIn.today.checkIn, isNotNull);
        expect(afterCheckIn.today.checkIn, matches(r'^\d{2}:\d{2}$'));
        expect(afterCheckIn.today.checkOut, isNull);

        await subject.checkOut(
          embedding: embedding,
          latitude: latitude,
          longitude: longitude,
        );
        final afterCheckOut = await subject.myAttendance();
        expect(afterCheckOut.today.checkOut, isNotNull);
        expect(afterCheckOut.today.checkOut, matches(r'^\d{2}:\d{2}$'));
      },
    );

    test('myAttendance includes worker profile fields', () async {
      final attendance = await subject.myAttendance();

      expect(attendance.employeeId, isNotEmpty);
      expect(attendance.fullName, isNotEmpty);
      expect(attendance.department, isNotEmpty);
      expect(attendance.workStartTime, isNotEmpty);
    });
  });
}
