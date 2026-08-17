import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/data/exceptions/attendance_exceptions.dart';
import 'package:worker_app/features/attendance/data/repositories/attendance_repository_impl.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/errors/attendance_failures.dart';

/// Xotirada ishlaydigan soxta (fake) masofaviy manba. `checkInError`/
/// `checkOutError`/`myAttendanceError` orqali datasource (tarmoq/server)
/// xatoliklarini simulyatsiya qiladi — `face_repository_test.dart`dagi
/// `_FakeFaceLocalDataSource`ning `readError`/`writeError` uslubiga
/// o'xshash.
class _FakeAttendanceRemoteDataSource implements AttendanceRemoteDataSource {
  CheckScanResult? checkInResult;
  CheckScanResult? checkOutResult;
  MyAttendance? myAttendanceResult;
  Exception? checkInError;
  Exception? checkOutError;
  Exception? myAttendanceError;

  @override
  Future<CheckScanResult> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    final err = checkInError;
    if (err != null) throw err;
    return checkInResult!;
  }

  @override
  Future<CheckScanResult> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    final err = checkOutError;
    if (err != null) throw err;
    return checkOutResult!;
  }

  @override
  Future<MyAttendance> myAttendance() async {
    final err = myAttendanceError;
    if (err != null) throw err;
    return myAttendanceResult!;
  }
}

void main() {
  group(AttendanceRepositoryImpl, () {
    late _FakeAttendanceRemoteDataSource remote;
    late AttendanceRepositoryImpl subject;

    const embedding = [0.1, 0.2, 0.3];
    const latitude = 41.3111;
    const longitude = 69.3402;

    final scanResult = CheckScanResult(
      isValid: true,
      faceScore: 0.91,
      type: 'CHECK_IN',
      isLate: false,
      lateMinutes: 0,
      recordedAt: DateTime(2026, 7, 24, 9),
    );

    const today = AttendanceDay(
      date: '2026-07-24',
      checkIn: '09:00',
      checkOut: null,
      status: AttendanceStatus.present,
      hours: 0,
      insideGeofence: true,
      selfConfirmed: true,
      confirmedAt: '09:00',
    );

    const attendance = MyAttendance(
      employeeId: 'EMP-1',
      fullName: 'Sardor Karimov',
      department: 'Kommunal xizmat',
      workStartTime: '09:00',
      today: today,
      week: [today],
    );

    setUp(() {
      remote = _FakeAttendanceRemoteDataSource();
      subject = AttendanceRepositoryImpl(remote: remote);
    });

    group('checkIn', () {
      test('datasource success -> Right(CheckScanResult)', () async {
        remote.checkInResult = scanResult;

        final result = await subject.checkIn(
          embedding: embedding,
          latitude: latitude,
          longitude: longitude,
        );

        result.fold(
          (l) => fail('expected Right(CheckScanResult), got Left: $l'),
          (r) => expect(r, scanResult),
        );
      });

      test(
        'datasource throws AlreadyCheckedInException -> '
        'Left(AlreadyCheckedInFailure) carrying its message (409)',
        () async {
          remote.checkInError = AlreadyCheckedInException(
            'Bugun allaqachon keldingiz belgilangan (backend)',
          );

          final result = await subject.checkIn(
            embedding: embedding,
            latitude: latitude,
            longitude: longitude,
          );

          result.fold((l) {
            expect(l, isA<AlreadyCheckedInFailure>());
            expect(
              l.message,
              'Bugun allaqachon keldingiz belgilangan (backend)',
            );
          }, (r) => fail('expected Left, got Right: $r'));
        },
      );

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.checkInError = ServerException('backend nosoz ishladi');

          final result = await subject.checkIn(
            embedding: embedding,
            latitude: latitude,
            longitude: longitude,
          );

          result.fold((l) {
            expect(l, isA<ServerFailure>());
            expect(l.message, 'backend nosoz ishladi');
          }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
        },
      );

      test(
        'datasource throws a generic Exception -> Left(ServerFailure) via '
        'the fallback branch (never escapes uncaught)',
        () async {
          remote.checkInError = Exception('kutilmagan xato');

          final result = await subject.checkIn(
            embedding: embedding,
            latitude: latitude,
            longitude: longitude,
          );

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });

    group('checkOut', () {
      test('datasource success -> Right(CheckScanResult)', () async {
        remote.checkOutResult = scanResult;

        final result = await subject.checkOut(
          embedding: embedding,
          latitude: latitude,
          longitude: longitude,
        );

        result.fold(
          (l) => fail('expected Right(CheckScanResult), got Left: $l'),
          (r) => expect(r, scanResult),
        );
      });

      test(
        'datasource throws AlreadyCheckedOutException -> '
        'Left(AlreadyCheckedOutFailure) carrying its message (409)',
        () async {
          remote.checkOutError = AlreadyCheckedOutException(
            'Bugun allaqachon ketganingiz belgilangan (backend)',
          );

          final result = await subject.checkOut(
            embedding: embedding,
            latitude: latitude,
            longitude: longitude,
          );

          result.fold((l) {
            expect(l, isA<AlreadyCheckedOutFailure>());
            expect(
              l.message,
              'Bugun allaqachon ketganingiz belgilangan (backend)',
            );
          }, (r) => fail('expected Left, got Right: $r'));
        },
      );

      test(
        'datasource throws NotCheckedInException -> Left(NotCheckedInFailure) '
        'carrying its message (400)',
        () async {
          remote.checkOutError = NotCheckedInException(
            'Avval kelganingizni belgilashingiz kerak (backend)',
          );

          final result = await subject.checkOut(
            embedding: embedding,
            latitude: latitude,
            longitude: longitude,
          );

          result.fold((l) {
            expect(l, isA<NotCheckedInFailure>());
            expect(
              l.message,
              'Avval kelganingizni belgilashingiz kerak (backend)',
            );
          }, (r) => fail('expected Left, got Right: $r'));
        },
      );
    });

    group('myAttendance', () {
      test('datasource success -> Right(MyAttendance)', () async {
        remote.myAttendanceResult = attendance;

        final result = await subject.myAttendance();

        result.fold(
          (l) => fail('expected Right(MyAttendance), got Left: $l'),
          (r) => expect(r, attendance),
        );
      });

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.myAttendanceError = ServerException('holatni olishda xato');

          final result = await subject.myAttendance();

          result.fold((l) {
            expect(l, isA<ServerFailure>());
            expect(l.message, 'holatni olishda xato');
          }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
        },
      );

      test(
        'datasource throws a generic Exception -> Left(ServerFailure) via '
        'the fallback branch (never escapes uncaught)',
        () async {
          remote.myAttendanceError = Exception('kutilmagan xato');

          final result = await subject.myAttendance();

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });
  });
}
