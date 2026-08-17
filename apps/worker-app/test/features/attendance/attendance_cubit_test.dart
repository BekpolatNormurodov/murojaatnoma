import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';

/// Xotirada ishlaydigan soxta repository — `check_in_test.dart`/
/// `attendance_repository_test.dart`dagi fake-based uslubga mos.
class _FakeAttendanceRepository implements AttendanceRepository {
  Either<Failure, MyAttendance> myAttendanceResult = const Right(
    MyAttendance(
      employeeId: 'EMP-1',
      fullName: 'Sardor Karimov',
      department: 'Kommunal xizmat',
      workStartTime: '09:00',
      today: AttendanceDay(
        date: '2026-07-24',
        checkIn: null,
        checkOut: null,
        status: AttendanceStatus.absent,
        hours: 0,
        insideGeofence: true,
        selfConfirmed: false,
        confirmedAt: null,
      ),
      week: [],
    ),
  );

  @override
  Future<Either<Failure, MyAttendance>> myAttendance() async =>
      myAttendanceResult;

  @override
  Future<Either<Failure, CheckScanResult>> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) {
    throw UnimplementedError('AttendanceCubit does not call checkIn');
  }

  @override
  Future<Either<Failure, CheckScanResult>> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) {
    throw UnimplementedError('AttendanceCubit does not call checkOut');
  }
}

AttendanceDay _day(
  String date, {
  AttendanceStatus status = AttendanceStatus.present,
  String? checkIn = '09:00',
  double hours = 8,
}) {
  return AttendanceDay(
    date: date,
    checkIn: checkIn,
    checkOut: null,
    status: status,
    hours: hours,
    insideGeofence: true,
    selfConfirmed: checkIn != null,
    confirmedAt: checkIn,
  );
}

MyAttendance _attendance({
  required AttendanceDay today,
  required List<AttendanceDay> week,
}) {
  return MyAttendance(
    employeeId: 'EMP-1',
    fullName: 'Sardor Karimov',
    department: 'Kommunal xizmat',
    workStartTime: '09:00',
    today: today,
    week: week,
  );
}

final _fakePosition = Position(
  latitude: 41.3111,
  longitude: 69.3402,
  timestamp: DateTime(2026, 7, 24, 9),
  accuracy: 5,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

final _outsidePosition = Position(
  latitude: 41.33,
  longitude: 69.36,
  timestamp: DateTime(2026, 7, 24, 9),
  accuracy: 5,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

void main() {
  group(AttendanceCubit, () {
    late _FakeAttendanceRepository repository;
    final geofence = GeofenceService();

    AttendanceCubit buildCubit({Future<Position> Function()? locate}) {
      return AttendanceCubit(
        repository: repository,
        geofence: geofence,
        locate: locate ?? () async => _fakePosition,
      );
    }

    setUp(() {
      repository = _FakeAttendanceRepository();
    });

    test('initial state is loading (never a blank/white screen)', () {
      expect(buildCubit().state, const AttendanceLoading());
    });

    group('load', () {
      blocTest<AttendanceCubit, AttendanceState>(
        'myAttendance() returns an empty week -> emits AttendanceEmpty',
        setUp: () => repository.myAttendanceResult = Right(
          _attendance(
            today: _day(
              '2026-07-24',
              checkIn: null,
              status: AttendanceStatus.absent,
            ),
            week: const [],
          ),
        ),
        build: buildCubit,
        act: (c) => c.load(),
        expect: () => [const AttendanceLoading(), const AttendanceEmpty()],
      );

      blocTest<AttendanceCubit, AttendanceState>(
        'myAttendance().today has a checkIn -> today is that exact entry',
        setUp: () => repository.myAttendanceResult = Right(
          _attendance(
            today: _day('2026-07-24'),
            week: [
              _day('2026-07-22'),
              _day('2026-07-23', status: AttendanceStatus.late),
              _day('2026-07-24'),
            ],
          ),
        ),
        build: buildCubit,
        act: (c) => c.load(),
        expect: () => [
          const AttendanceLoading(),
          isA<AttendanceLoaded>()
              .having((s) => s.today, 'today', _day('2026-07-24'))
              .having((s) => s.week, 'week', hasLength(3)),
        ],
      );

      blocTest<AttendanceCubit, AttendanceState>(
        'myAttendance().today.checkIn is null -> today is null (a distinct '
        "'not yet checked in' state, not a synthesized absent record, even "
        "though the server's today.status may say 'absent')",
        setUp: () => repository.myAttendanceResult = Right(
          _attendance(
            today: _day(
              '2026-07-24',
              checkIn: null,
              status: AttendanceStatus.absent,
            ),
            week: [
              _day('2026-07-21'),
              _day('2026-07-22'),
              _day('2026-07-23'),
            ],
          ),
        ),
        build: buildCubit,
        act: (c) => c.load(),
        expect: () => [
          const AttendanceLoading(),
          isA<AttendanceLoaded>()
              .having((s) => s.today, 'today', isNull)
              .having((s) => s.week, 'week', hasLength(3)),
        ],
      );

      blocTest<AttendanceCubit, AttendanceState>(
        'week is passed through exactly as returned by the server (no '
        'client-side sorting/truncation needed anymore)',
        setUp: () => repository.myAttendanceResult = Right(
          _attendance(
            today: _day('2026-07-24'),
            week: [
              for (final d in [18, 19, 20, 21, 22, 23, 24])
                _day('2026-07-${d.toString().padLeft(2, '0')}'),
            ],
          ),
        ),
        build: buildCubit,
        act: (c) => c.load(),
        expect: () => [
          const AttendanceLoading(),
          isA<AttendanceLoaded>()
              .having(
                (s) => s.week.map((d) => d.date).toList(),
                'week dates',
                [
                  '2026-07-18',
                  '2026-07-19',
                  '2026-07-20',
                  '2026-07-21',
                  '2026-07-22',
                  '2026-07-23',
                  '2026-07-24',
                ],
              ),
        ],
      );

      blocTest<AttendanceCubit, AttendanceState>(
        'myAttendance() returns Left(Failure) -> emits AttendanceError with '
        "the failure's message (never uncaught)",
        setUp: () => repository.myAttendanceResult = const Left(
          ServerFailure('tarmoq xatosi'),
        ),
        build: buildCubit,
        act: (c) => c.load(),
        expect: () => [
          const AttendanceLoading(),
          const AttendanceError('tarmoq xatosi'),
        ],
      );

      blocTest<AttendanceCubit, AttendanceState>(
        'always starts by emitting AttendanceLoading, even when called '
        'again after a previous load (never a blank/white screen while '
        'refreshing)',
        setUp: () => repository.myAttendanceResult = Right(
          _attendance(
            today: _day(
              '2026-07-24',
              checkIn: null,
              status: AttendanceStatus.absent,
            ),
            week: const [],
          ),
        ),
        build: buildCubit,
        seed: () => const AttendanceLoaded(today: null, week: []),
        act: (c) => c.load(),
        expect: () => [const AttendanceLoading(), const AttendanceEmpty()],
      );
    });

    group('checkGeofence', () {
      test('inside the workplace radius -> true', () async {
        final cubit = buildCubit(locate: () async => _fakePosition);
        expect(await cubit.checkGeofence(), isTrue);
      });

      test('far from the workplace radius -> false', () async {
        final cubit = buildCubit(locate: () async => _outsidePosition);
        expect(await cubit.checkGeofence(), isFalse);
      });

      test('location lookup throws (denied permission/service off/etc) -> '
          'null (never uncaught)', () async {
        final cubit = buildCubit(
          locate: () async => throw StateError('ruxsat berilmagan'),
        );
        expect(await cubit.checkGeofence(), isNull);
      });
    });
  });
}
