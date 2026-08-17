import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/errors/attendance_failures.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/attendance_scan_params.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/face/data/services/face_detector_service.dart';
import 'package:worker_app/features/face/data/services/face_embedder.dart';
import 'package:worker_app/features/face/domain/entities/attendance_scan_kind.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:worker_app/features/face/domain/usecases/enroll_face.dart';
import 'package:worker_app/features/face/domain/usecases/verify_face.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';

class _MockFaceDetectorService extends Mock implements FaceDetectorService {}

class _MockFaceEmbedder extends Mock implements FaceEmbedder {}

class _MockEnrollFace extends Mock implements EnrollFace {}

class _MockVerifyFace extends Mock implements VerifyFace {}

class _MockCheckIn extends Mock implements CheckIn {}

class _MockCheckOut extends Mock implements CheckOut {}

class _MockGeofenceService extends Mock implements GeofenceService {}

void main() {
  group(FaceCubit, () {
    // Task 17 (liveness check-in) qismi — Task 16 (enrollment) testlari
    // `face_cubit_test.dart`da qoladi, bu fayl faqat `startLiveness` /
    // `onLivenessFrame` / `verifyAndCheckIn` (post-liveness qaror-mantiq)
    // ustida. Task 19 check-out ("ketdi") qismi — `kind:
    // AttendanceScanKind.checkOut` bilan ishga tushirilgan urinishlarni
    // qamrab oladigan alohida guruh (`verifyAndCheckIn (check-out mode)`).
    late FaceDetectorService detector;
    late FaceEmbedder embedder;
    late EnrollFace enrollFace;
    late VerifyFace verifyFace;
    late CheckIn checkIn;
    late CheckOut checkOut;
    late GeofenceService geofence;
    late DateTime now;

    setUpAll(() {
      // `checkIn(any())` / `verifyNever(() => checkIn(any()))` below need a
      // registered fallback for mocktail's argument matcher machinery.
      registerFallbackValue(
        const AttendanceScanParams(embedding: [], latitude: 0, longitude: 0),
      );
    });

    const testProbe = [0.12, 0.34, 0.56];
    // `DateTime(...)` (unlike `Duration(...)`) has no const constructor, so
    // this fixture can't be a compile-time constant — `final` instead.
    final fakePosition = Position(
      latitude: 41.2995,
      longitude: 69.2401,
      timestamp: DateTime(2026, 7, 23, 9, 15),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

    CheckScanResult validScanResult({String type = 'CHECK_IN'}) =>
        CheckScanResult(
          isValid: true,
          faceScore: 0.94,
          type: type,
          isLate: false,
          lateMinutes: 0,
          recordedAt: DateTime(2026, 7, 23, 9),
        );

    FaceCubit buildCubit() {
      return FaceCubit(
        detector: detector,
        embedder: embedder,
        enrollFace: enrollFace,
        verifyFace: verifyFace,
        checkIn: checkIn,
        checkOut: checkOut,
        geofence: geofence,
        workerId: 'W-1042',
        clock: () => now,
        locate: () async => fakePosition,
      );
    }

    setUp(() {
      detector = _MockFaceDetectorService();
      embedder = _MockFaceEmbedder();
      enrollFace = _MockEnrollFace();
      verifyFace = _MockVerifyFace();
      checkIn = _MockCheckIn();
      checkOut = _MockCheckOut();
      geofence = _MockGeofenceService();
      now = DateTime(2026, 7, 23, 9);
      // `FaceCubit.close()` always disposes the detector (see
      // `face_cubit_test.dart` — same rationale applies here).
      when(() => detector.dispose()).thenAnswer((_) async {});
    });

    group('startLiveness + onLivenessFrame (pure liveness progress)', () {
      blocTest<FaceCubit, FaceState>(
        'emits livenessPrompt(action, done, total) as each action fires, '
        'ending with action=null when complete',
        build: buildCubit,
        act: (cubit) {
          cubit
            ..startLiveness(const [
              LivenessAction.turnLeft,
              LivenessAction.turnRight,
            ])
            ..onLivenessFrame(const FaceSignal(headEulerY: 30)) // turnLeft
            ..onLivenessFrame(const FaceSignal(headEulerY: -30)); // turnRight
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.turnLeft,
            done: 0,
            total: 2,
          ),
          const FaceLivenessPrompt(
            action: LivenessAction.turnRight,
            done: 1,
            total: 2,
          ),
          const FaceLivenessPrompt(action: null, done: 2, total: 2),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'no liveness in progress -> onLivenessFrame is a no-op',
        build: buildCubit,
        act: (cubit) => cubit.onLivenessFrame(const FaceSignal(headEulerY: 30)),
        expect: () => <FaceState>[],
      );

      blocTest<FaceCubit, FaceState>(
        'elapsed time exceeding the liveness timeout -> livenessFailed',
        build: buildCubit,
        act: (cubit) {
          cubit
            ..startLiveness(const [LivenessAction.blink])
            // t=0: arms the challenge clock, no advance (irrelevant signal).
            ..onLivenessFrame(const FaceSignal());
          now = now.add(const Duration(seconds: 21));
          cubit.onLivenessFrame(const FaceSignal());
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceLivenessFailed(),
        ],
      );
    });

    group('onNoFace() (Fix 2 regression: timeout w/ zero detected faces)', () {
      blocTest<FaceCubit, FaceState>(
        'no liveness in progress -> onNoFace is a no-op',
        build: buildCubit,
        act: (cubit) => cubit.onNoFace(),
        expect: () => <FaceState>[],
      );

      blocTest<FaceCubit, FaceState>(
        'the timeout is armed by startLiveness() itself — a face that is '
        'NEVER detected still times out to livenessFailed (bug: previously '
        'only onLivenessFrame armed/checked the clock, so a user who never '
        'lines up with the camera would be stuck in FaceSearching forever)',
        build: buildCubit,
        act: (cubit) {
          cubit.startLiveness(const [LivenessAction.blink]);
          // Under the timeout: FaceSearching, NOT livenessFailed yet.
          now = now.add(const Duration(seconds: 10));
          cubit.onNoFace();
          // Now past the 20s timeout, still zero faces ever detected.
          now = now.add(const Duration(seconds: 11));
          cubit.onNoFace();
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceSearching(),
          const FaceLivenessFailed(),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'a livenessFailed timeout from onNoFace() stops all further '
        'liveness activity until retry()',
        build: buildCubit,
        act: (cubit) {
          cubit.startLiveness(const [LivenessAction.blink]);
          now = now.add(const Duration(seconds: 25));
          cubit
            ..onNoFace() // fires livenessFailed
            ..onNoFace() // already-failed attempt: no-op
            ..onLivenessFrame(const FaceSignal(leftEye: 0.1, rightEye: 0.1));
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceLivenessFailed(),
        ],
      );
    });

    group('verifyAndCheckIn (post-liveness decision logic — the seam)', () {
      blocTest<FaceCubit, FaceState>(
        'full flow: liveness complete -> VerifyFace passed=true -> CheckIn '
        'called with the locate() position -> checkinSuccess',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.94, passed: true)),
          );
          when(
            () => checkIn(
              AttendanceScanParams(
                embedding: testProbe,
                latitude: fakePosition.latitude,
                longitude: fakePosition.longitude,
              ),
            ),
          ).thenAnswer((_) async => Right(validScanResult()));
        },
        act: (cubit) async {
          cubit
            ..startLiveness(const [
              LivenessAction.turnLeft,
              LivenessAction.turnRight,
            ])
            ..onLivenessFrame(const FaceSignal(headEulerY: 30))
            ..onLivenessFrame(const FaceSignal(headEulerY: -30));
          await cubit.verifyAndCheckIn(
            testProbe,
            screenshotPath: 'attendance/2026-07-23.jpg',
          );
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.turnLeft,
            done: 0,
            total: 2,
          ),
          const FaceLivenessPrompt(
            action: LivenessAction.turnRight,
            done: 1,
            total: 2,
          ),
          const FaceLivenessPrompt(action: null, done: 2, total: 2),
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceCheckinSuccess('09:00'),
        ],
        verify: (_) {
          verify(
            () => checkIn(
              AttendanceScanParams(
                embedding: testProbe,
                latitude: fakePosition.latitude,
                longitude: fakePosition.longitude,
              ),
            ),
          ).called(1);
          // Check-out oqimi (standart `kind` — checkIn — bilan) HECH QACHON
          // chaqirilmasligi kerak.
          verifyNever(() => checkOut(any()));
        },
      );

      blocTest<FaceCubit, FaceState>(
        'VerifyFace passed=false -> matchFailed (CheckIn never called)',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.21, passed: false)),
          );
        },
        act: (cubit) => cubit.verifyAndCheckIn(testProbe),
        expect: () => [const FaceVerifying(), const FaceMatchFailed()],
        verify: (_) {
          verifyNever(() => checkIn(any()));
        },
      );

      blocTest<FaceCubit, FaceState>(
        'VerifyFace passed=true but CheckIn -> Left(GeofenceFailure) -> '
        'geofenceOutside',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(
            () => checkIn(any()),
          ).thenAnswer((_) async => const Left(GeofenceFailure()));
          when(
            () => geofence.distanceMeters(
              kWorkplaceLat,
              kWorkplaceLng,
              fakePosition.latitude,
              fakePosition.longitude,
            ),
          ).thenReturn(320.5);
        },
        act: (cubit) => cubit.verifyAndCheckIn(testProbe),
        expect: () => [
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceGeofenceOutside(distanceMeters: 320.5),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'VerifyFace returns Left(failure) -> generic error state (never '
        'uncaught)',
        build: buildCubit,
        setUp: () {
          when(
            () => verifyFace(const VerifyFaceParams(testProbe)),
          ).thenAnswer((_) async => const Left(CacheFailure('shablon yoq')));
        },
        act: (cubit) => cubit.verifyAndCheckIn(testProbe),
        expect: () => [const FaceVerifying(), isA<FaceError>()],
      );

      blocTest<FaceCubit, FaceState>(
        'CheckIn returns a non-geofence failure -> generic error state',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(
            () => checkIn(any()),
          ).thenAnswer((_) async => const Left(ServerFailure('500')));
        },
        act: (cubit) => cubit.verifyAndCheckIn(testProbe),
        expect: () => [
          const FaceVerifying(),
          const FaceCheckingIn(),
          isA<FaceError>(),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'locate() throwing (denied GPS permission) -> generic error state, '
        'CheckIn never called',
        build: () => FaceCubit(
          detector: detector,
          embedder: embedder,
          enrollFace: enrollFace,
          verifyFace: verifyFace,
          checkIn: checkIn,
          checkOut: checkOut,
          geofence: geofence,
          workerId: 'W-1042',
          clock: () => now,
          locate: () async => throw StateError("joylashuvga ruxsat yo'q"),
        ),
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
        },
        act: (cubit) => cubit.verifyAndCheckIn(testProbe),
        expect: () => [const FaceVerifying(), isA<FaceError>()],
        verify: (_) {
          verifyNever(() => checkIn(any()));
        },
      );
    });

    group('verifyAndCheckIn (check-out mode — Vazifa 19)', () {
      // `startLiveness(kind: AttendanceScanKind.checkOut)` orqali ishga
      // tushirilgan urinishlarda `_afterMatch` `CheckIn` o'rniga `CheckOut`
      // chaqirishi kerak — check-in yo'li (yuqoridagi guruh) 100%
      // o'zgarishsiz qolgani esa alohida tekshirildi.
      blocTest<FaceCubit, FaceState>(
        'full flow: kind=checkOut -> VerifyFace passed=true -> CheckOut '
        '(NOT CheckIn) called -> checkinSuccess',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.94, passed: true)),
          );
          when(
            () => checkOut(
              AttendanceScanParams(
                embedding: testProbe,
                latitude: fakePosition.latitude,
                longitude: fakePosition.longitude,
              ),
            ),
          ).thenAnswer(
            (_) async => Right(validScanResult(type: 'CHECK_OUT')),
          );
        },
        act: (cubit) async {
          cubit.startLiveness(
            const [LivenessAction.smile],
            kind: AttendanceScanKind.checkOut,
          );
          await cubit.verifyAndCheckIn(testProbe);
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.smile,
            done: 0,
            total: 1,
          ),
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceCheckinSuccess('09:00'),
        ],
        verify: (_) {
          verify(
            () => checkOut(
              AttendanceScanParams(
                embedding: testProbe,
                latitude: fakePosition.latitude,
                longitude: fakePosition.longitude,
              ),
            ),
          ).called(1);
          verifyNever(() => checkIn(any()));
        },
      );

      blocTest<FaceCubit, FaceState>(
        'kind=checkOut + CheckOut -> Left(GeofenceFailure) -> '
        'geofenceOutside',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(
            () => checkOut(any()),
          ).thenAnswer((_) async => const Left(GeofenceFailure()));
          when(
            () => geofence.distanceMeters(
              kWorkplaceLat,
              kWorkplaceLng,
              fakePosition.latitude,
              fakePosition.longitude,
            ),
          ).thenReturn(150);
        },
        act: (cubit) {
          cubit.startLiveness(
            const [LivenessAction.blink],
            kind: AttendanceScanKind.checkOut,
          );
          return cubit.verifyAndCheckIn(testProbe);
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceGeofenceOutside(distanceMeters: 150),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'kind=checkOut + CheckOut -> Left(AlreadyCheckedOutFailure) -> '
        "generic FaceError surfacing the backend's uz message",
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(() => checkOut(any())).thenAnswer(
            (_) async => const Left(AlreadyCheckedOutFailure()),
          );
        },
        act: (cubit) {
          cubit.startLiveness(
            const [LivenessAction.blink],
            kind: AttendanceScanKind.checkOut,
          );
          return cubit.verifyAndCheckIn(testProbe);
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceError('Bugun allaqachon ketganingiz belgilangan'),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'kind=checkOut + CheckOut -> Left(NotCheckedInFailure) -> generic '
        "FaceError surfacing the backend's uz message",
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(
            () => checkOut(any()),
          ).thenAnswer((_) async => const Left(NotCheckedInFailure()));
        },
        act: (cubit) {
          cubit.startLiveness(
            const [LivenessAction.blink],
            kind: AttendanceScanKind.checkOut,
          );
          return cubit.verifyAndCheckIn(testProbe);
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceError('Avval kelganingizni belgilashingiz kerak'),
        ],
      );

      blocTest<FaceCubit, FaceState>(
        'default kind (no kind passed to startLiveness) is checkIn -> '
        'CheckOut is never called',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(
            () => checkIn(any()),
          ).thenAnswer((_) async => Right(validScanResult()));
        },
        act: (cubit) {
          cubit.startLiveness(const [LivenessAction.blink]);
          return cubit.verifyAndCheckIn(testProbe);
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.blink,
            done: 0,
            total: 1,
          ),
          const FaceVerifying(),
          const FaceCheckingIn(),
          const FaceCheckinSuccess('09:00'),
        ],
        verify: (_) {
          verifyNever(() => checkOut(any()));
        },
      );
    });

    group('canTriggerCapture (Fix 1 regression: capture fires at most once '
        'per attempt)', () {
      // `onFrame` (device-only, not exercised in unit tests) triggers
      // `_captureAndVerify` iff `canTriggerCapture` is true, and flips
      // `_captureConsumed` immediately — before that, it was checking
      // `_livenessController.isComplete` directly, which stays `true`
      // forever once the challenge finishes, so EVERY subsequent
      // detected-face frame re-ran the whole capture->verify->checkIn
      // pipeline (stacking non-dismissible dialogs, re-spamming
      // VerifyFace/CheckIn — worst for `geofenceOutside`, whose distance
      // reading changes slightly on every GPS fix so the state never
      // dedupes). These tests assert the exact decision `onFrame` reads
      // (`canTriggerCapture`) becomes `false` right after a
      // `verifyAndCheckIn` call resolves to a non-terminal failure — i.e.
      // a subsequent `onFrame` frame provably will NOT re-fire, without
      // needing a real camera frame to reach the device-only trigger
      // itself.
      test('false before completion, true once complete, false again after '
          'verifyAndCheckIn resolves to matchFailed', () async {
        final cubit = buildCubit();
        addTearDown(cubit.close);
        when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
          (_) async => const Right(FaceMatchResult(0.1, passed: false)),
        );

        cubit.startLiveness(const [LivenessAction.turnLeft]);
        expect(
          cubit.canTriggerCapture,
          isFalse,
          reason: 'challenge just started, not complete yet',
        );

        cubit.onLivenessFrame(const FaceSignal(headEulerY: 30));
        expect(
          cubit.canTriggerCapture,
          isTrue,
          reason:
              'challenge just completed and nothing has consumed it yet '
              '— this is the exact condition onFrame checks to decide '
              'whether to fire _captureAndVerify',
        );

        await cubit.verifyAndCheckIn(testProbe); // -> matchFailed

        expect(
          cubit.canTriggerCapture,
          isFalse,
          reason:
              'consumed: isComplete is still true (LivenessController '
              'never resets itself) but a later onFrame must NOT re-fire '
              'capture for this same attempt',
        );
      });

      test(
        'false again after verifyAndCheckIn resolves to geofenceOutside',
        () async {
          final cubit = buildCubit();
          addTearDown(cubit.close);
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.9, passed: true)),
          );
          when(
            () => checkIn(any()),
          ).thenAnswer((_) async => const Left(GeofenceFailure()));
          when(
            () => geofence.distanceMeters(
              kWorkplaceLat,
              kWorkplaceLng,
              fakePosition.latitude,
              fakePosition.longitude,
            ),
          ).thenReturn(200);

          cubit
            ..startLiveness(const [LivenessAction.smile])
            ..onLivenessFrame(const FaceSignal(smile: 0.9));
          expect(cubit.canTriggerCapture, isTrue);

          await cubit.verifyAndCheckIn(testProbe); // -> geofenceOutside

          expect(cubit.canTriggerCapture, isFalse);
        },
      );

      blocTest<FaceCubit, FaceState>(
        'retry() after a consumed attempt makes canTriggerCapture reachable '
        'again for the new attempt',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.1, passed: false)),
          );
        },
        act: (cubit) async {
          cubit
            ..startLiveness(const [LivenessAction.turnRight])
            // A 1-action list completes on the very first matching feed, so
            // this alone already flips canTriggerCapture to true and emits
            // the "done" prompt (action: null) below.
            ..onLivenessFrame(const FaceSignal(headEulerY: -30));
          await cubit.verifyAndCheckIn(testProbe); // -> matchFailed, consumed
          expect(cubit.canTriggerCapture, isFalse);
          cubit.retry();
          expect(cubit.canTriggerCapture, isFalse); // fresh attempt, 0/1 done
          cubit.onLivenessFrame(const FaceSignal(headEulerY: -30));
          expect(cubit.canTriggerCapture, isTrue); // complete again, unconsumed
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.turnRight,
            done: 0,
            total: 1,
          ),
          const FaceLivenessPrompt(action: null, done: 1, total: 1),
          const FaceVerifying(),
          const FaceMatchFailed(),
          const FaceLivenessPrompt(
            action: LivenessAction.turnRight,
            done: 0,
            total: 1,
          ),
          const FaceLivenessPrompt(action: null, done: 1, total: 1),
        ],
      );
    });

    group('retry()', () {
      blocTest<FaceCubit, FaceState>(
        'retry() after matchFailed rebuilds a fresh liveness prompt from '
        'the same action list',
        build: buildCubit,
        setUp: () {
          when(() => verifyFace(const VerifyFaceParams(testProbe))).thenAnswer(
            (_) async => const Right(FaceMatchResult(0.1, passed: false)),
          );
        },
        act: (cubit) async {
          cubit.startLiveness(const [LivenessAction.smile]);
          await cubit.verifyAndCheckIn(testProbe);
          cubit.retry();
        },
        expect: () => [
          const FaceLivenessPrompt(
            action: LivenessAction.smile,
            done: 0,
            total: 1,
          ),
          const FaceVerifying(),
          const FaceMatchFailed(),
          const FaceLivenessPrompt(
            action: LivenessAction.smile,
            done: 0,
            total: 1,
          ),
        ],
      );
    });

    group('checkGeofence() (live banner helper)', () {
      test('reports inside + distance via GeofenceService/locate()', () async {
        final cubit = buildCubit();
        addTearDown(cubit.close);
        when(
          () =>
              geofence.isInside(fakePosition.latitude, fakePosition.longitude),
        ).thenReturn(true);
        when(
          () => geofence.distanceMeters(
            kWorkplaceLat,
            kWorkplaceLng,
            fakePosition.latitude,
            fakePosition.longitude,
          ),
        ).thenReturn(12.5);

        final status = await cubit.checkGeofence();

        expect(status.isInside, isTrue);
        expect(status.distanceMeters, 12.5);
      });

      test('reports outside via GeofenceService/locate()', () async {
        final cubit = buildCubit();
        addTearDown(cubit.close);
        when(
          () =>
              geofence.isInside(fakePosition.latitude, fakePosition.longitude),
        ).thenReturn(false);
        when(
          () => geofence.distanceMeters(
            kWorkplaceLat,
            kWorkplaceLng,
            fakePosition.latitude,
            fakePosition.longitude,
          ),
        ).thenReturn(410);

        final status = await cubit.checkGeofence();

        expect(status.isInside, isFalse);
        expect(status.distanceMeters, 410);
      });

      test('degrades to unknown (never throws) when locate() fails', () async {
        final cubit = FaceCubit(
          detector: detector,
          embedder: embedder,
          enrollFace: enrollFace,
          verifyFace: verifyFace,
          checkIn: checkIn,
          checkOut: checkOut,
          geofence: geofence,
          workerId: 'W-1042',
          locate: () async => throw StateError('GPS off'),
        );
        addTearDown(cubit.close);

        final status = await cubit.checkGeofence();

        expect(status.isInside, isNull);
        expect(status.distanceMeters, isNull);
      });
    });
  });
}
