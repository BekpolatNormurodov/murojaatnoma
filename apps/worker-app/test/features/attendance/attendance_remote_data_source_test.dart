import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/core/mock/mock_attendance.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';

void main() {
  // Faqat Mock impl sinaladi — Api impl jonli backend talab qiladi
  // (mock-first; qarang: `AttendanceRemoteDataSourceApiImpl`).
  group(AttendanceRemoteDataSourceMockImpl, () {
    late AttendanceRemoteDataSourceMockImpl subject;
    late List<AttendanceDay> seed;

    const params = CheckInParams(
      lat: 41.3111,
      lng: 69.3402,
      screenshotPath: '/tmp/shot.jpg',
    );

    // `mockAttendanceHistory` — modul darajasidagi (global), testlar
    // orasida ulashiladigan mutable ro'yxat; `checkIn` unga qo'shadi.
    // Testlar tartibidan mustaqil bo'lishi (bir-biriga holat "sizdirmasligi")
    // uchun har bir testdan OLDIN joriy holatni saqlab olamiz (`setUp`) va
    // testdan KEYIN asl holatga qaytaramiz (`tearDown`) — shu bilan har bir
    // test doim bir xil, boshlang'ich urug' (seed) holatidan boshlanadi.
    setUp(() {
      subject = AttendanceRemoteDataSourceMockImpl();
      seed = List<AttendanceDay>.of(mockAttendanceHistory);
    });

    tearDown(() {
      mockAttendanceHistory
        ..clear()
        ..addAll(seed);
    });

    test(
      'checkIn returns an AttendanceDay for today with the expected shape',
      () async {
        final day = await subject.checkIn(params);

        expect(day.selfConfirmed, isTrue);
        expect(day.insideGeofence, isTrue);
        expect(day.status, AttendanceStatus.present);
        expect(day.checkIn, isNotNull);
        expect(day.checkIn, matches(r'^\d{2}:\d{2}$'));
        expect(day.confirmedAt, isNotNull);
        expect(day.confirmedAt, matches(r'^\d{2}:\d{2}$'));
      },
    );

    test(
      'checkIn appends the created day to history (list-append proven)',
      () async {
        final before = await subject.history();

        final created = await subject.checkIn(params);
        final after = await subject.history();

        expect(after.length, before.length + 1);
        expect(after.last, created);
        expect(after, contains(created));
      },
    );
  });
}
