import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/data/repositories/attendance_repository_impl.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';

/// Xotirada ishlaydigan soxta (fake) masofaviy manba. `checkInError`/
/// `historyError` orqali datasource (tarmoq/server) xatoliklarini
/// simulyatsiya qiladi — `face_repository_test.dart`dagi
/// `_FakeFaceLocalDataSource`ning `readError`/`writeError` uslubiga
/// o'xshash.
class _FakeAttendanceRemoteDataSource implements AttendanceRemoteDataSource {
  AttendanceDay? checkInResult;
  List<AttendanceDay>? historyResult;
  Exception? checkInError;
  Exception? historyError;

  @override
  Future<AttendanceDay> checkIn(CheckInParams params) async {
    final err = checkInError;
    if (err != null) throw err;
    return checkInResult!;
  }

  @override
  Future<List<AttendanceDay>> history() async {
    final err = historyError;
    if (err != null) throw err;
    return historyResult!;
  }
}

void main() {
  group(AttendanceRepositoryImpl, () {
    late _FakeAttendanceRemoteDataSource remote;
    late AttendanceRepositoryImpl subject;

    const params = CheckInParams(
      lat: 41.3111,
      lng: 69.3402,
      screenshotPath: '/tmp/shot.jpg',
    );

    const day = AttendanceDay(
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
      remote = _FakeAttendanceRemoteDataSource();
      subject = AttendanceRepositoryImpl(remote: remote);
    });

    group('checkIn', () {
      test('datasource success -> Right(AttendanceDay)', () async {
        remote.checkInResult = day;

        final result = await subject.checkIn(params);

        result.fold(
          (l) => fail('expected Right(AttendanceDay), got Left: $l'),
          (r) => expect(r, day),
        );
      });

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.checkInError = ServerException('backend nosoz ishladi');

          final result = await subject.checkIn(params);

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

          final result = await subject.checkIn(params);

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });

    group('history', () {
      test('datasource success -> Right(List<AttendanceDay>)', () async {
        remote.historyResult = [day];

        final result = await subject.history();

        result.fold(
          (l) => fail('expected Right(List<AttendanceDay>), got Left: $l'),
          (r) => expect(r, [day]),
        );
      });

      test(
        'datasource throws ServerException -> Left(ServerFailure) '
        'carrying its message',
        () async {
          remote.historyError = ServerException('tarixni olishda xato');

          final result = await subject.history();

          result.fold((l) {
            expect(l, isA<ServerFailure>());
            expect(l.message, 'tarixni olishda xato');
          }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
        },
      );

      test(
        'datasource throws a generic Exception -> Left(ServerFailure) via '
        'the fallback branch (never escapes uncaught)',
        () async {
          remote.historyError = Exception('kutilmagan xato');

          final result = await subject.history();

          result.fold(
            (l) => expect(l, isA<ServerFailure>()),
            (r) => fail('expected Left(ServerFailure), got Right: $r'),
          );
        },
      );
    });
  });
}
