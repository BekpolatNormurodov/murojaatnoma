import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';

/// Xotirada ishlaydigan soxta (fake) repository. `checkIn` necha marta
/// chaqirilganini kuzatadi — geofence tashqarisida `CheckIn` usecase
/// repository'ga UMUMAN tegmasligini isbotlash uchun (Vazifa 15ning
/// bog'lovchi talabi).
class _FakeAttendanceRepository implements AttendanceRepository {
  int checkInCallCount = 0;
  Either<Failure, AttendanceDay> checkInResult = const Left(
    ServerFailure('sozlanmagan natija'),
  );

  @override
  Future<Either<Failure, AttendanceDay>> checkIn(CheckInParams params) async {
    checkInCallCount++;
    return checkInResult;
  }

  @override
  Future<Either<Failure, List<AttendanceDay>>> history() async {
    return const Right([]);
  }
}

void main() {
  group(CheckIn, () {
    late _FakeAttendanceRepository repository;
    late CheckIn subject;

    const knownDay = AttendanceDay(
      date: '2026-07-24',
      checkIn: '09:00',
      checkOut: null,
      status: AttendanceStatus.present,
      hours: 0,
      insideGeofence: true,
      selfConfirmed: true,
      confirmedAt: '09:00',
    );

    setUp(() {
      repository = _FakeAttendanceRepository()
        ..checkInResult = const Right(knownDay);
      subject = CheckIn(repository, GeofenceService());
    });

    test(
      'outside geofence -> Left(GeofenceFailure); repository never called',
      () async {
        // Ish joyidan (41.3111, 69.3402) ~2km uzoqda — 150m radiusdan
        // tashqarida.
        const params = CheckInParams(
          lat: 41.33,
          lng: 69.36,
          screenshotPath: '/tmp/shot.jpg',
        );

        final result = await subject(params);

        result.fold(
          (l) => expect(l, isA<GeofenceFailure>()),
          (r) => fail('expected Left(GeofenceFailure), got Right: $r'),
        );
        expect(repository.checkInCallCount, 0);
      },
    );

    test(
      'inside geofence -> Right(AttendanceDay) with selfConfirmed true',
      () async {
        const params = CheckInParams(
          lat: 41.3111,
          lng: 69.3402,
          screenshotPath: '/tmp/shot.jpg',
        );

        final result = await subject(params);

        result.fold((l) => fail('expected Right, got Left: $l'), (day) {
          expect(day.selfConfirmed, isTrue);
        });
        expect(repository.checkInCallCount, 1);
      },
    );
  });
}
