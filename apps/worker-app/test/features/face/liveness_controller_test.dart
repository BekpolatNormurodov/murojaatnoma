import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:worker_app/features/face/domain/services/liveness_controller.dart';

void main() {
  test('advances through blink then turnLeft to completion', () {
    final c = LivenessController([
      LivenessAction.blink,
      LivenessAction.turnLeft,
    ]);
    expect(c.current, LivenessAction.blink);
    // ko'z ochiq — o'zgarmaydi
    c.feed(const FaceSignal(leftEye: 0.9, rightEye: 0.9));
    expect(c.current, LivenessAction.blink);
    // ko'z yumildi → blink bajarildi
    c.feed(const FaceSignal(leftEye: 0.1, rightEye: 0.1));
    expect(c.current, LivenessAction.turnLeft);
    expect(c.progress, 0.5);
    // bosh chapga (eulerY > 25)
    c.feed(const FaceSignal(headEulerY: 30));
    expect(c.isComplete, isTrue);
    expect(c.progress, 1.0);
  });

  test(
    'blink does NOT fire on closed eyes without prior open (anti-photo)',
    () {
      final c = LivenessController([LivenessAction.blink]);
      // ignore: cascade_invocations -- state must be checked between feeds
      c.feed(const FaceSignal(leftEye: 0.1, rightEye: 0.1)); // arming yo'q
      expect(c.isComplete, isFalse);
      // ignore: cascade_invocations -- state must be checked between feeds
      c.feed(const FaceSignal(leftEye: 0.9, rightEye: 0.9)); // arm
      // ignore: cascade_invocations -- state must be checked between feeds
      c.feed(const FaceSignal(leftEye: 0.1, rightEye: 0.1)); // fire
      expect(c.isComplete, isTrue);
    },
  );

  test('irrelevant/null signal does not crash or advance', () {
    final c = LivenessController([LivenessAction.turnLeft]);
    // ignore: cascade_invocations -- state must be checked between feeds
    c.feed(const FaceSignal(leftEye: 0.9, rightEye: 0.9)); // irrelevant
    expect(c.current, LivenessAction.turnLeft); // should not advance
    c.feed(const FaceSignal(headEulerY: 30)); // relevant
    expect(c.isComplete, isTrue);
  });

  test('feed after completion is a no-op', () {
    final c = LivenessController([LivenessAction.smile])
      ..feed(const FaceSignal(smile: 0.9))
      ..feed(const FaceSignal(smile: 0.9)); // no-op
    expect(c.isComplete, isTrue);
    expect(c.progress, 1.0);
  });

  test('turnRight and smile thresholds', () {
    final c = LivenessController([
      LivenessAction.turnRight,
      LivenessAction.smile,
    ]);
    // ignore: cascade_invocations -- state must be checked between feeds
    c.feed(const FaceSignal(headEulerY: -30)); // turnRight
    expect(c.current, LivenessAction.smile); // advanced
    c.feed(const FaceSignal(smile: 0.7)); // smile
    expect(c.isComplete, isTrue);
  });

  test('empty steps is immediately complete', () {
    final c = LivenessController([]);
    expect(c.isComplete, isTrue);
    expect(c.progress, 1.0);
  });
}
