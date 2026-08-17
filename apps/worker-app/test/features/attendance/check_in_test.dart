import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/attendance_scan_params.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';

/// Xotirada ishlaydigan soxta (fake) repository. `checkIn` necha marta
/// chaqirilganini kuzatadi — geofence tashqarisida `CheckIn` usecase
/// repository'ga UMUMAN tegmasligini isbotlash uchun (Vazifa 15ning
/// bog'lovchi talabi).
class _FakeAttendanceRepository implements AttendanceRepository {
  int checkInCallCount = 0;
  Either<Failure, CheckScanResult> checkInResult = const Left(
    ServerFailure('sozlanmagan natija'),
  );

  @override
  Future<Either<Failure, CheckScanResult>> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    checkInCallCount++;
    return checkInResult;
  }

  @override
  Future<Either<Failure, CheckScanResult>> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    throw UnimplementedError('not used in these tests');
  }

  @override
  Future<Either<Failure, MyAttendance>> myAttendance() async {
    throw UnimplementedError('not used in these tests');
  }
}

void main() {
  group(CheckIn, () {
    late _FakeAttendanceRepository repository;
    late CheckIn subject;

    final knownResult = CheckScanResult(
      isValid: true,
      faceScore: 0.91,
      type: 'CHECK_IN',
      isLate: false,
      lateMinutes: 0,
      recordedAt: DateTime(2026, 7, 24, 9),
    );

    setUp(() {
      repository = _FakeAttendanceRepository()
        ..checkInResult = Right(knownResult);
      subject = CheckIn(repository, GeofenceService());
    });

    test(
      'outside geofence -> Left(GeofenceFailure); repository never called',
      () async {
        // Ish joyidan (41.3111, 69.3402) ~2km uzoqda — 150m radiusdan
        // tashqarida.
        const params = AttendanceScanParams(
          embedding: [0.1, 0.2, 0.3],
          latitude: 41.33,
          longitude: 69.36,
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
      'inside geofence -> Right(CheckScanResult) with isValid true',
      () async {
        const params = AttendanceScanParams(
          embedding: [0.1, 0.2, 0.3],
          latitude: 41.3111,
          longitude: 69.3402,
        );

        final result = await subject(params);

        result.fold((l) => fail('expected Right, got Left: $l'), (r) {
          expect(r.isValid, isTrue);
        });
        expect(repository.checkInCallCount, 1);
      },
    );
  });
}
