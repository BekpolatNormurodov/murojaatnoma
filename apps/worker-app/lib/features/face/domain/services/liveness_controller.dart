import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';

class LivenessController {
  LivenessController(this.steps);

  final List<LivenessAction> steps;
  var _done = 0;
  var _sawEyesOpen = false;

  LivenessAction? get current {
    if (_done >= steps.length) {
      return null;
    }
    return steps[_done];
  }

  double get progress {
    if (steps.isEmpty) {
      return 1;
    }
    return _done / steps.length;
  }

  bool get isComplete => _done >= steps.length;

  void feed(FaceSignal signal) {
    if (isComplete) {
      return;
    }

    final action = current;

    switch (action) {
      case LivenessAction.blink:
        _feedBlink(signal);
      case LivenessAction.turnLeft:
        _feedTurnLeft(signal);
      case LivenessAction.turnRight:
        _feedTurnRight(signal);
      case LivenessAction.smile:
        _feedSmile(signal);
      case null:
        break;
    }
  }

  void _feedBlink(FaceSignal signal) {
    if (signal.leftEye != null && signal.rightEye != null) {
      final leftEye = signal.leftEye!;
      final rightEye = signal.rightEye!;

      if (leftEye > 0.6 && rightEye > 0.6) {
        _sawEyesOpen = true;
      } else if (_sawEyesOpen && leftEye < 0.2 && rightEye < 0.2) {
        _advance();
      }
    }
  }

  void _feedTurnLeft(FaceSignal signal) {
    if (signal.headEulerY != null && signal.headEulerY! > 25) {
      _advance();
    }
  }

  void _feedTurnRight(FaceSignal signal) {
    if (signal.headEulerY != null && signal.headEulerY! < -25) {
      _advance();
    }
  }

  void _feedSmile(FaceSignal signal) {
    if (signal.smile != null && signal.smile! > 0.6) {
      _advance();
    }
  }

  void _advance() {
    _done++;
    _sawEyesOpen = false;
  }
}
