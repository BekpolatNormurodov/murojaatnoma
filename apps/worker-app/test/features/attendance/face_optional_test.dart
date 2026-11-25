import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/app/router/redirect_policy.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

/// Yuz skaneri ixtiyoriy (`faceRequired == false`) oqimi: kamera ochilmay,
/// faqat joylashuv bilan check-in/out.
class _RecordingRepository implements AttendanceRepository {
  bool faceRequired = false;
  final calls = <Map<String, Object?>>[];
  Either<Failure, CheckScanResult> result = Right(
    CheckScanResult(
      isValid: true,
      faceScore: 0,
      type: 'CHECK_IN',
      isLate: false,
      lateMinutes: 0,
      recordedAt: DateTime(2026, 11, 25, 9),
    ),
  );
  int loads = 0;

  Future<Either<Failure, CheckScanResult>> _record(
    String type,
    double latitude,
    double longitude,
    List<double>? embedding,
    String? photoUrl,
    double? accuracy,
  ) async {
    calls.add({
      'type': type,
      'latitude': latitude,
      'longitude': longitude,
      'embedding': embedding,
      'photoUrl': photoUrl,
      'accuracy': accuracy,
    });
    return result;
  }

  @override
  Future<Either<Failure, CheckScanResult>> checkIn({
    required double latitude,
    required double longitude,
    List<double>? embedding,
    String? photoUrl,
    double? accuracy,
  }) => _record('in', latitude, longitude, embedding, photoUrl, accuracy);

  @override
  Future<Either<Failure, CheckScanResult>> checkOut({
    required double latitude,
    required double longitude,
    List<double>? embedding,
    String? photoUrl,
    double? accuracy,
  }) => _record('out', latitude, longitude, embedding, photoUrl, accuracy);

  @override
  Future<Either<Failure, MyAttendance>> myAttendance() async {
    loads++;
    return Right(
      MyAttendance(
        employeeId: 'E',
        fullName: 'F',
        department: 'D',
        workStartTime: '09:00',
        faceRequired: faceRequired,
        today: const AttendanceDay(
          date: '2026-11-25',
          checkIn: null,
          checkOut: null,
          status: AttendanceStatus.absent,
          hours: 0,
          insideGeofence: true,
          selfConfirmed: false,
          confirmedAt: null,
        ),
        week: const [
          AttendanceDay(
            date: '2026-11-24',
            checkIn: '09:00',
            checkOut: '18:00',
            status: AttendanceStatus.present,
            hours: 9,
            insideGeofence: true,
            selfConfirmed: true,
            confirmedAt: '09:00',
          ),
        ],
      ),
    );
  }
}

final _position = Position(
  latitude: 41.3111,
  longitude: 69.3402,
  timestamp: DateTime(2026, 11, 25, 9),
  accuracy: 12,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

void main() {
  group('MyAttendance.faceRequired', () {
    test('missing field (older backend) is treated as required', () {
      expect(MyAttendance.fromJson(const {}).faceRequired, isTrue);
    });
    test('false is parsed', () {
      expect(
        MyAttendance.fromJson(const {'faceRequired': false}).faceRequired,
        isFalse,
      );
    });
  });

  group('scanBody', () {
    test('location-only body when no embedding', () {
      expect(
        scanBody(
          latitude: 1,
          longitude: 2,
          accuracy: 7,
          photoUrl: '/uploads/x.jpg',
        ),
        {'latitude': 1.0, 'longitude': 2.0, 'accuracy': 7.0},
      );
    });
    test('face body unchanged when embedding given', () {
      expect(
        scanBody(
          latitude: 1,
          longitude: 2,
          embedding: const [0.1, 0.2],
          photoUrl: '/uploads/x.jpg',
        ),
        {
          'embedding': [0.1, 0.2],
          'latitude': 1.0,
          'longitude': 2.0,
          'photoUrl': '/uploads/x.jpg',
        },
      );
    });
  });

  group('AttendanceCubit.markByLocation (face not required)', () {
    late _RecordingRepository repository;
    late AttendanceCubit cubit;

    setUp(() {
      repository = _RecordingRepository();
      final geofence = GeofenceService();
      cubit = AttendanceCubit(
        repository: repository,
        geofence: geofence,
        checkIn: CheckIn(repository, geofence, localGate: false),
        checkOut: CheckOut(repository, geofence, localGate: false),
        locate: () async => _position,
      );
    });

    tearDown(() => cubit.close());

    test('load exposes faceRequired=false in state and getter', () async {
      await cubit.load();
      expect(cubit.faceRequired, isFalse);
      final state = cubit.state;
      expect(state, isA<AttendanceLoaded>());
      expect((state as AttendanceLoaded).faceRequired, isFalse);
    });

    test('check-in sends location only (no embedding/photo) and reloads',
        () async {
      await cubit.load();
      final loadsBefore = repository.loads;

      final outcome = await cubit.markByLocation();

      expect(outcome.success, isTrue);
      expect(outcome.message, 'Kelganingiz belgilandi');
      expect(repository.calls, hasLength(1));
      final call = repository.calls.single;
      expect(call['type'], 'in');
      expect(call['embedding'], isNull);
      expect(call['photoUrl'], isNull);
      expect(call['latitude'], 41.3111);
      expect(call['longitude'], 69.3402);
      expect(call['accuracy'], 12.0);
      expect(repository.loads, loadsBefore + 1);
    });

    test('check-out uses CheckOut', () async {
      final outcome = await cubit.markByLocation(checkOut: true);
      expect(outcome.success, isTrue);
      expect(repository.calls.single['type'], 'out');
    });

    test('server rejection surfaces the message, no throw', () async {
      repository.result = const Left(ServerFailure('Hududdan tashqaridasiz'));
      final outcome = await cubit.markByLocation();
      expect(outcome.success, isFalse);
      expect(outcome.message, 'Hududdan tashqaridasiz');
    });

    test('a rejected mark reloads, picking up the admin switch', () async {
      await cubit.load();
      // Admin turned the face scan on while the screen was open.
      repository
        ..faceRequired = true
        ..result = const Left(ServerFailure('Yuz kerak'));
      final states = <AttendanceState>[];
      final sub = cubit.stream.listen(states.add);
      addTearDown(sub.cancel);

      final outcome = await cubit.markByLocation();
      await pumpEventQueue();

      expect(outcome.success, isFalse);
      expect(cubit.faceRequired, isTrue);
      expect((cubit.state as AttendanceLoaded).faceRequired, isTrue);
      // Silent: no skeleton flash.
      expect(states.whereType<AttendanceLoading>(), isEmpty);
    });

    test('a GPS timeout gives a readable message', () async {
      final slow = AttendanceCubit(
        repository: repository,
        geofence: GeofenceService(),
        checkIn: CheckIn(repository, GeofenceService(), localGate: false),
        locate: () async => throw TimeoutException('gps'),
      );
      addTearDown(slow.close);
      final outcome = await slow.markByLocation();
      expect(outcome.message, contains('Joylashuv aniqlanmadi'));
    });

    test('location failure is reported without calling the server', () async {
      final failing = AttendanceCubit(
        repository: repository,
        geofence: GeofenceService(),
        checkIn: CheckIn(repository, GeofenceService(), localGate: false),
        locate: () async => throw StateError('Joylashuvga ruxsat berilmagan'),
      );
      addTearDown(failing.close);
      final outcome = await failing.markByLocation();
      expect(outcome.success, isFalse);
      expect(outcome.message, 'Joylashuvga ruxsat berilmagan');
      expect(repository.calls, isEmpty);
    });
  });

  group('resolveAuthRedirect with faceRequired=false', () {
    const noFaceOptional = AuthState(
      status: AuthStatus.authenticated,
      faceRequired: false,
    );

    test('un-enrolled employee is not forced into /face/enroll', () {
      for (final loc in ['/home', '/requests', '/profile', '/reports']) {
        expect(
          resolveAuthRedirect(authState: noFaceOptional, location: loc),
          isNull,
          reason: loc,
        );
      }
    });

    test('auth-flow and enroll screens go home; /home settles', () {
      expect(
        resolveAuthRedirect(authState: noFaceOptional, location: '/login'),
        '/home',
      );
      expect(
        resolveAuthRedirect(
          authState: noFaceOptional,
          location: '/face/enroll',
        ),
        '/home',
      );
    });

    test('voluntary enrolment from the profile is allowed', () {
      expect(
        resolveAuthRedirect(
          authState: noFaceOptional,
          location: '/face/enroll',
          voluntaryEnroll: true,
        ),
        isNull,
      );
    });

    test('faceRequired=true keeps the old enrollment gate', () {
      const gated = AuthState(status: AuthStatus.authenticated);
      expect(
        resolveAuthRedirect(authState: gated, location: '/home'),
        '/face/enroll',
      );
    });
  });
}
