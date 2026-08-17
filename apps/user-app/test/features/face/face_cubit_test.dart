import 'dart:ui';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/face/data/services/face_detector_service.dart';
import 'package:user_app/features/face/data/services/face_embedder.dart';
import 'package:user_app/features/face/domain/entities/face_signal.dart';
import 'package:user_app/features/face/domain/usecases/enroll_face.dart';
import 'package:user_app/features/face/presentation/bloc/face_cubit.dart';

class _MockFaceDetectorService extends Mock implements FaceDetectorService {}

class _MockFaceEmbedder extends Mock implements FaceEmbedder {}

class _MockEnrollFace extends Mock implements EnrollFace {}

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
        ownerId: 'U-2087',
        clock: () => now,
      );
    }

    setUp(() {
      detector = _MockFaceDetectorService();
      embedder = _MockFaceEmbedder();
      enrollFace = _MockEnrollFace();
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

    blocTest<FaceCubit, FaceState>(
      'sustained good detections align to 1.0 then trigger capture',
      build: buildCubit,
      act: (cubit) {
        cubit.onDetection(goodFace()); // t=0ms    -> progress 0.0
        now = now.add(const Duration(milliseconds: 750));
        cubit.onDetection(goodFace()); // t=750ms  -> progress 0.5
        now = now.add(const Duration(milliseconds: 750));
        cubit.onDetection(goodFace()); // t=1500ms -> progress 1.0, capture()
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
      now = now.add(const Duration(milliseconds: 750));
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
