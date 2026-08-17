import 'dart:ui';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/face/data/services/face_detector_service.dart';
import 'package:worker_app/features/face/data/services/face_embedder.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:worker_app/features/face/domain/usecases/enroll_face.dart';
import 'package:worker_app/features/face/domain/usecases/verify_face.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';

class _MockFaceDetectorService extends Mock implements FaceDetectorService {}

class _MockFaceEmbedder extends Mock implements FaceEmbedder {}

class _MockEnrollFace extends Mock implements EnrollFace {}

// Vazifa 17: `FaceCubit` endi check-in (liveness) rejimini ham qamrab
// oladi, shuning uchun konstruktor bu uch bog'liqlikni ham talab qiladi —
// bu fayldagi (Vazifa 16, enrollment) testlar ularni hech qachon
// chaqirmaydi, shuning uchun mock'lar hech qachon stub qilinmaydi.
class _MockVerifyFace extends Mock implements VerifyFace {}

class _MockCheckIn extends Mock implements CheckIn {}

class _MockCheckOut extends Mock implements CheckOut {}

class _MockGeofenceService extends Mock implements GeofenceService {}

void main() {
  group(FaceCubit, () {
    // `FaceCubit` assumes this frame size until a real `CameraImage` has
    // been seen via `onFrame` (device-only, never exercised here) — see
    // `FaceCubit._defaultFrameSize`. Fixtures below are built relative to
    // its center so the pure `onDetection` gate is fully deterministic.
    const frameCenter = Offset(640, 360);

    late FaceDetectorService detector;
    late FaceEmbedder embedder;
    late EnrollFace enrollFace;
    late VerifyFace verifyFace;
    late CheckIn checkIn;
    late CheckOut checkOut;
    late GeofenceService geofence;
    late DateTime now;

    DetectedFace goodFace({double headEulerY = 0, double eyeOpen = 0.9}) {
      return DetectedFace(
        boundingBox: Rect.fromCenter(
          center: frameCenter,
          width: 300,
          height: 300,
        ),
        signal: FaceSignal(
          leftEye: eyeOpen,
          rightEye: eyeOpen,
          headEulerY: headEulerY,
        ),
      );
    }

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
      now = DateTime(2026);
      // `FaceCubit.close()` always disposes the detector, even when the
      // camera itself was never started in these pure-logic tests.
      when(() => detector.dispose()).thenAnswer((_) async {});
    });

    test('starts in FaceInitializing', () {
      expect(buildCubit().state, const FaceInitializing());
    });

    blocTest<FaceCubit, FaceState>(
      'no face detected -> FaceSearching',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(null),
      expect: () => [const FaceSearching()],
    );

    blocTest<FaceCubit, FaceState>(
      'small bounding box (face far away) -> poorQuality(tooFar)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(
        DetectedFace(
          boundingBox: Rect.fromCenter(
            center: frameCenter,
            width: 80,
            height: 80,
          ),
          signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
        ),
      ),
      expect: () => [const FacePoorQuality(PoorQualityReason.tooFar)],
    );

    blocTest<FaceCubit, FaceState>(
      'huge bounding box (face too close) -> poorQuality(tooClose)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(
        DetectedFace(
          boundingBox: Rect.fromCenter(
            center: frameCenter,
            width: 680,
            height: 680,
          ),
          signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
        ),
      ),
      expect: () => [const FacePoorQuality(PoorQualityReason.tooClose)],
    );

    blocTest<FaceCubit, FaceState>(
      "bounding box shifted toward the raw frame's negative/left side -> "
      'poorQuality(moveLeft) (user must move to their own left to '
      're-center; see PoorQualityReason.moveLeft doc for the mirror '
      'derivation)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(
        DetectedFace(
          // Default frame is 1280x720 (center 640,360); box centered at
          // (150,150) -> dx=-490 (|.| /1280 = 0.38, over the 0.30 gate)
          // dominates dy=-210 (|.| /720 = 0.29, under the gate alone).
          boundingBox: Rect.fromCenter(
            center: const Offset(150, 150),
            width: 300,
            height: 300,
          ),
          signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
        ),
      ),
      expect: () => [const FacePoorQuality(PoorQualityReason.moveLeft)],
    );

    blocTest<FaceCubit, FaceState>(
      "bounding box shifted toward the raw frame's positive/right side -> "
      'poorQuality(moveRight)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(
        DetectedFace(
          // dx=+490 (mirror of the moveLeft case above) -> moveRight.
          boundingBox: Rect.fromCenter(
            center: const Offset(1130, 360),
            width: 300,
            height: 300,
          ),
          signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
        ),
      ),
      expect: () => [const FacePoorQuality(PoorQualityReason.moveRight)],
    );

    blocTest<FaceCubit, FaceState>(
      'bounding box shifted below the raw frame center -> '
      'poorQuality(moveUp) (no mirroring on the vertical axis)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(
        DetectedFace(
          // dy=+260 (|.| /720 = 0.36, over gate), dx=0.
          boundingBox: Rect.fromCenter(
            center: const Offset(640, 620),
            width: 300,
            height: 300,
          ),
          signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
        ),
      ),
      expect: () => [const FacePoorQuality(PoorQualityReason.moveUp)],
    );

    blocTest<FaceCubit, FaceState>(
      'bounding box shifted above the raw frame center -> '
      'poorQuality(moveDown)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(
        DetectedFace(
          // dy=-260 (mirror of the moveUp case above) -> moveDown.
          boundingBox: Rect.fromCenter(
            center: const Offset(640, 100),
            width: 300,
            height: 300,
          ),
          signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
        ),
      ),
      expect: () => [const FacePoorQuality(PoorQualityReason.moveDown)],
    );

    blocTest<FaceCubit, FaceState>(
      'large head yaw -> poorQuality(turned)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(goodFace(headEulerY: 30)),
      expect: () => [const FacePoorQuality(PoorQualityReason.turned)],
    );

    blocTest<FaceCubit, FaceState>(
      'low eye-open probability -> poorQuality(eyesClosed)',
      build: buildCubit,
      act: (cubit) => cubit.onDetection(goodFace(eyeOpen: 0.1)),
      expect: () => [const FacePoorQuality(PoorQualityReason.eyesClosed)],
    );

    // Real-device UX bug regression (Fix A): the pre-fix thresholds
    // (0.28/0.16/12°/0.4) rejected realistic front-camera detections that a
    // user would reasonably consider "well centered in the oval" — the gate
    // never passed on a real phone. Each case below would have hit
    // `PoorQuality` under the OLD constants but must now reach
    // `FaceAligning` (progress 0, i.e. quality accepted) under the new
    // ones. See the `_evaluateQuality` doc comment for the root-cause
    // breakdown.
    group('loosened gate now accepts realistic real-device faces', () {
      blocTest<FaceCubit, FaceState>(
        'smaller bbox (~19% of frame, under the old 28% floor) -> accepted',
        build: buildCubit,
        act: (cubit) => cubit.onDetection(
          DetectedFace(
            boundingBox: Rect.fromCenter(
              center: frameCenter,
              width: 140,
              height: 140,
            ),
            signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
          ),
        ),
        expect: () => [const FaceAligning(0)],
      );

      blocTest<FaceCubit, FaceState>(
        'oval-vs-frame-center offset (~20%, over the old 16% cap) -> '
        'accepted',
        build: buildCubit,
        act: (cubit) => cubit.onDetection(
          DetectedFace(
            boundingBox: Rect.fromCenter(
              center: frameCenter.translate(0, 144), // 144/720 = 20%
              width: 300,
              height: 300,
            ),
            signal: const FaceSignal(leftEye: 0.9, rightEye: 0.9),
          ),
        ),
        expect: () => [const FaceAligning(0)],
      );

      blocTest<FaceCubit, FaceState>(
        'moderate head turn (15°, over the old 12° cap) -> accepted',
        build: buildCubit,
        act: (cubit) => cubit.onDetection(goodFace(headEulerY: 15)),
        expect: () => [const FaceAligning(0)],
      );

      blocTest<FaceCubit, FaceState>(
        'relaxed eye-open probability (0.35, over the old 0.4 floor) -> '
        'accepted',
        build: buildCubit,
        act: (cubit) => cubit.onDetection(goodFace(eyeOpen: 0.35)),
        expect: () => [const FaceAligning(0)],
      );

      blocTest<FaceCubit, FaceState>(
        'typical real-device frame — size/offset/turn/eyes each individually '
        'over an old cap, all at once -> still accepted',
        build: buildCubit,
        act: (cubit) => cubit.onDetection(
          DetectedFace(
            boundingBox: Rect.fromCenter(
              // 145/720 = 20% relative size (old floor 28%, new floor 14%).
              center: frameCenter.translate(30, 158), // dy/720 = 22%
              width: 145,
              height: 145,
            ),
            signal: const FaceSignal(
              leftEye: 0.33, // old floor 0.4, new floor 0.3
              rightEye: 0.33,
              headEulerY: 14, // old cap 12°, new cap 20°
            ),
          ),
        ),
        expect: () => [const FaceAligning(0)],
      );
    });

    blocTest<FaceCubit, FaceState>(
      'sustained good detections align to 1.0 then trigger capture',
      build: buildCubit,
      act: (cubit) {
        cubit.onDetection(goodFace()); // t=0ms   -> progress 0.0
        now = now.add(const Duration(milliseconds: 450));
        cubit.onDetection(goodFace()); // t=450ms -> progress 0.5
        now = now.add(const Duration(milliseconds: 450));
        cubit.onDetection(goodFace()); // t=900ms -> progress 1.0, capture()
      },
      expect: () => [
        const FaceAligning(0),
        const FaceAligning(0.5),
        const FaceAligning(1),
        const FaceCapturing(),
        // `capture()` needs a real `CameraImage` (set by the device-only
        // `onFrame`), never fed here — it must fail gracefully, not hang
        // or throw uncaught.
        isA<FaceError>(),
      ],
    );

    test('a quality break resets stability progress back to 0', () {
      final cubit = buildCubit();

      // ignore: cascade_invocations -- state must be checked between feeds
      cubit.onDetection(goodFace());
      now = now.add(const Duration(milliseconds: 450));
      cubit.onDetection(goodFace());
      expect(cubit.state, const FaceAligning(0.5));

      cubit.onDetection(goodFace(headEulerY: 30)); // break
      expect(cubit.state, const FacePoorQuality(PoorQualityReason.turned));

      cubit.onDetection(goodFace()); // good again -> timer restarted
      expect(cubit.state, const FaceAligning(0));
    });

    test('retry() after a capture error resumes live detection', () {
      final cubit = buildCubit();

      // ignore: cascade_invocations -- state must be checked between feeds
      cubit.onDetection(goodFace());
      now = now.add(const Duration(milliseconds: 1500));
      cubit.onDetection(goodFace()); // -> capturing -> error (no frame)
      expect(cubit.state, isA<FaceError>());

      cubit.retry();
      expect(cubit.state, const FaceSearching());

      cubit.onDetection(goodFace());
      expect(cubit.state, const FaceAligning(0));
    });
  });
}
